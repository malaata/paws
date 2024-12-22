const fs = require('fs');
const path = require('path');
const axios = require('axios');
const pLimit = require('p-limit');
const winston = require('winston');
const config = require('./config.json');

// 配置日志
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ level, message, timestamp }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
    ),
    transports: [new winston.transports.Console()]
});

// 配置 API URL
const { baseURL, authEndpoint, questListEndpoint, completeTaskEndpoint, claimTaskEndpoint } = config.api;
const AUTH_URL = `${baseURL}${authEndpoint}`;
const QUEST_LIST_URL = `${baseURL}${questListEndpoint}`;
const COMPLETE_TASK_URL = `${baseURL}${completeTaskEndpoint}`;
const CLAIM_TASK_URL = `${baseURL}${claimTaskEndpoint}`;

// 读取文件数据
function loadFileLines(filePath) {
    return fs.readFileSync(path.resolve(__dirname, filePath), 'utf8').trim().split('\n');
}

const queryIds = loadFileLines(config.files.hashFile);
const userAgents = loadFileLines(config.files.userAgentFile);

// 随机获取 User-Agent
function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// 延迟函数
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 带重试的操作
async function withRetry(fn, retries = config.retryAttempts) {
    let attempt = 0;
    while (attempt < retries) {
        try {
            return await fn();
        } catch (error) {
            attempt++;
            logger.warn(`重试 (${attempt}/${retries}) 失败，错误: ${error.message}`);
            if (attempt >= retries) throw error;
            await delay(config.minDelay);
        }
    }
}

// 身份认证
async function authenticate(query_id, headers) {
    try {
        const response = await axios.post(AUTH_URL, { data: query_id }, { headers });
        if (response.data.success) {
            const token = response.data.data[0];
            const user = response.data.data[1];
            logger.info(`用户 ${user.userData.username} 登录成功，初始余额: ${user.gameData.balance}`);
            return { token, username: user.userData.username, balance: user.gameData.balance };
        } else {
            throw new Error('认证失败');
        }
    } catch (error) {
        throw new Error(`身份认证失败：${error.response ? error.response.data : error.message}`);
    }
}

// 获取任务列表
async function getQuestList(token, headers) {
    const response = await axios.get(QUEST_LIST_URL, {
        headers: { ...headers, Authorization: `Bearer ${token}` }
    });
    return response.data.data;
}

// 完成任务
async function completeTask(token, questId, headers) {
    await axios.post(COMPLETE_TASK_URL, { questId }, {
        headers: { ...headers, Authorization: `Bearer ${token}` }
    });
    logger.info(`任务 ${questId} 已完成`);
}

// 领取奖励
async function claimTask(token, questId, headers) {
    await axios.post(CLAIM_TASK_URL, { questId }, {
        headers: { ...headers, Authorization: `Bearer ${token}` }
    });
    logger.info(`任务 ${questId} 奖励已领取`);
}

// 处理单个用户
async function processUser(query_id) {
    const userAgent = getRandomUserAgent();
    const headers = {
        'User-Agent': userAgent,
        'Accept': 'application/json',
        'Connection': 'keep-alive',
    };

    try {
        const { token, username, balance } = await withRetry(() => authenticate(query_id, headers));
        const quests = await withRetry(() => getQuestList(token, headers));

        for (const quest of quests) {
            const { _id, title, rewards, progress } = quest;
            if (!progress.claimed && progress.status === "start") {
                logger.info(`完成任务：${title}`);
                await withRetry(() => completeTask(token, _id, headers));
                await withRetry(() => claimTask(token, _id, headers));
            } else if (!progress.claimed && progress.status === "claimable") {
                logger.info(`领取任务奖励：${title}`);
                await withRetry(() => claimTask(token, _id, headers));
            } else {
                logger.info(`任务已完成：${title}`);
            }

            await delay(config.minDelay + Math.random() * (config.maxDelay - config.minDelay));
        }

        const updatedBalanceData = await withRetry(() => authenticate(query_id, headers));
        logger.info(`用户 ${username} 更新后余额: ${updatedBalanceData.balance}`);
    } catch (error) {
        logger.error(`处理用户 ${query_id} 时出错: ${error.message}`);
    }
}

// 执行所有用户任务
async function executeQuestsForAllUsers() {
    const limit = pLimit(config.concurrency);
    const tasks = queryIds.map(query_id => limit(() => processUser(query_id)));

    await Promise.all(tasks);
    logger.info("所有任务执行完成！");
}

// 主程序入口
(async () => {
    logger.info("开始任务执行...");
    await executeQuestsForAllUsers();
    logger.info("任务执行完成，程序将在 24 小时后再次运行...");
})();

// 每 24 小时执行一次
setInterval(async () => {
    logger.info("重新开始任务执行...");
    await executeQuestsForAllUsers();
}, 24 * 60 * 60 * 1000);
