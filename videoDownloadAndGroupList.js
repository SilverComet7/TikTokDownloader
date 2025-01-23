const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const { allGameList } = require('D:\\code\\study_technology\\back_end_pratice\\getBiliBili_jili_List\\baseAvg.js')


async function downloadVideosAndGroup({
  isDownload,    // 是否下载视频,  false 则只进行mp4文件分组

  checkNewAdd,    // 检测新旧文件对比，只下载新增的文件

  allDownload,    // 是否开启setting.json中全部视频的下载

  checkName, // 检测debugger

  currentUpdateGameList,    // 控制哪些game下载

  earliest,    // 统一下载的最早时间,为空字符串则没有日期限制下载全部作品,活动起始时间

}) {

  try {
    const settingsPath = path.join(__dirname, 'settings.json');
    let settingsData = await fsPromises.readFile(settingsPath, "utf8");
    let settings = JSON.parse(settingsData);
    let accountsUrls = settings.accounts_urls;
    const oldSettingsPath = path.join(__dirname, 'oldSettings.json');
    let oldSettingsData = await fsPromises.readFile(oldSettingsPath, "utf8");
    let oldSettings = JSON.parse(oldSettingsData);
    let oldAccountsUrls = oldSettings.accounts_urls;


    const scriptDirPath = path.join(__dirname, 'script') || 'D:\\code\\TikTokDownloader';
    console.log("🚀 ~ scriptDirPath:", scriptDirPath)

    if (isDownload) {
      accountsUrls = accountsUrls.map(acc => {
        if (currentUpdateGameList.includes(acc.game)) {
          acc.enable = true;
        } else {
          acc.enable = false;
        }
        // 对比新旧数据,将新增的 name 启用,其它都禁用
        if (checkNewAdd) {
          const oldAcc = oldAccountsUrls.find(oldAcc => oldAcc.name === acc.name);
          if (oldAcc) {
            acc.enable = false;
          } else {
            acc.enable = true;
          }
        }
        if (allDownload) acc.enable = true;
        if (earliest || earliest == '') acc.earliest = earliest
        return acc;
      });
      settings.run_command = '6 1 1 Q'

      // 更新 settings.json 文件
      await fsPromises.writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf8");
      console.log("settings.json 更新完成");

      // 2. 如果存在enable，使用 python 调用 main.py

      const hasEnableGame = accountsUrls.some(acc => acc.enable);

      if (hasEnableGame) {
        const pythonScriptPath = path.join(__dirname, 'main.py');
        const pythonExecutable = 'python'; // 如果不在系统路径中，可以使用完整路径，例如 'C:\\Python39\\python.exe'

        try {
          console.log(`Python 脚本开始执行: `);
          const outputBuffer = execSync(`${pythonExecutable} ${pythonScriptPath}`, { encoding: 'utf8' });
          // const output = iconv.decode(outputBuffer, 'gbk'); // 假设 Python 脚本输出使用 GBK 编码
          console.log(`Python 脚本标准输出: ${outputBuffer}`);

          // 更新下载了的日期为当前日期 XXXX/XX/XX
          const currentDate = new Date().toLocaleDateString();
          accountsUrls = accountsUrls.map(acc => {
            if (currentUpdateGameList.includes(acc.game)) {
              acc.earliest = currentDate;
            }
            return acc;
          });
          // 更新 settings.json 文件
          await fsPromises.writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf8");
          console.log("settings.json 更新完成");
        } catch (error) {
          console.error(`执行 Python 脚本时出错: ${error.message}`);
          console.error(`Python 脚本标准错误输出: ${error.stderr}`);
          return;
        }
      }
      // 更新 settings.json 文件
      await fsPromises.writeFile(oldSettingsPath, JSON.stringify(settings, null, 2), "utf8");
    }

    // 3. 下载完成后自动按game分组

    // 全部游戏类型，后续将coser同行 coser本人 的mp4视频,根据名称是否包含该游戏分组到各自的游戏文件夹下的对应子文件夹 coser同行 coser本人
    let gameArr = accountsUrls.filter(item => !['coser同行', 'coser本人'].includes(item.game)).map(acc => acc.game).concat(currentUpdateGameList)
    gameArr = [...new Set(gameArr.concat(allGameList))]
    // 遍历特定目录下的所有文件夹
    const files = await fsPromises.readdir('D:\\code\\TikTokDownloader', { withFileTypes: true });

    for (const file of files) {
      if (file.isDirectory() && file.name !== 'cache' && file.name !== 'Download') {
        const folderName = file.name;
        const account = accountsUrls.find(acc => folderName.includes(acc.name)); // 是否有这个

        if (account && account.game) {
          let gameFolder = path.join('D:\\code\\TikTokDownloader\\gameList', account.game);
          if (!fs.existsSync(gameFolder) && (account.game !== 'coser同行' && account.game !== 'coser本人')) {
            await fsPromises.mkdir(gameFolder, { recursive: true });
          }

          const directoryFolder = await fsPromises.readdir('D:\\code\\TikTokDownloader\\' + folderName);

          // 遍历文件夹
          for (const fileName of directoryFolder) {
            // 是mp4文件且文件标题包含某个游戏类型
            const gameName = gameArr.find(game => fileName.includes(game))
            if (path.extname(fileName).toLowerCase() === '.mp4' && gameName) {
              const oldFilePath = path.join('D:\\code\\TikTokDownloader\\' + folderName, fileName);
              if (account.game === 'coser同行' || account.game === 'coser本人') {
                gameFolder = path.join('D:\\code\\TikTokDownloader\\gameList', gameName + '/' + account.game); // gameList/游戏名/coserXX
              } else {
                gameFolder = path.join('D:\\code\\TikTokDownloader\\gameList', gameName + '/攻略'); // gameList/游戏名/攻略
              }
              if (!fs.existsSync(gameFolder)) {
                await fsPromises.mkdir(gameFolder, { recursive: true });
                await fsPromises.mkdir(path.join(gameFolder, '/未处理'), { recursive: true });
              }
              let newFilePath = path.join(gameFolder, fileName);
              if (checkName) {
                console.log("🚀 ~ processFiles ~ newFilePath:", newFilePath)
                continue
              }
              try {
                await fsPromises.rename(oldFilePath, newFilePath);
                console.log(`文件已重命名并移动: ${oldFilePath} -> ${newFilePath}`);
              } catch (err) {
                console.error('无法重命名文件:', err);
              }
            } else if (path.extname(fileName).toLowerCase() === '.mp4' && (account.game === 'coser同行' || account.game === 'coser本人')) {

              // 不包含游戏类型，是coser，可分组后查看手动区分游戏


              const gameFolder = path.join('D:\\code\\TikTokDownloader\\gameList', account.game);
              // if (!fs.existsSync(gameFolder)) {
              //   await fsPromises.mkdir(gameFolder, { recursive: true });
              // }
              const oldFilePath = path.join('D:\\code\\TikTokDownloader\\' + folderName, fileName);
              let newFilePath = path.join(gameFolder, fileName);
              if (checkName) {
                console.log("🚀 ~ processFiles ~ newFilePath:", newFilePath)
                continue
              }
              try {
                await fsPromises.rename(oldFilePath, newFilePath);
                console.log(`文件移动到新文件夹: ${oldFilePath} -> ${newFilePath}`);
              } catch (err) {
                console.error('无法移动文件:', err);
              }
            }
          }
        }
      }
    }
  }
  catch (err) {
    console.error('读取或解析settings.json文件时出错:', err);
  }
}

// downloadVideosAndGroup({
//   isDownload: true,    // 是否下载视频,  false 则只进行mp4文件分组

//   checkNewAdd: true,    // 检测新旧文件对比，只下载新增的文件,避免下载量太大

//   allDownload: false,    // 是否开启setting.json中全部视频的下载

//   checkName: false, // 检测debugger

//   currentUpdateGameList: ["火影忍者"],    // 控制哪些game下载

//   earliest: '2024/9/19',    // 统一下载的最早时间,为空字符串则没有日期限制下载全部作品,活动起始时间

// })

module.exports = {
  downloadVideosAndGroup
}
// 保持每个游戏大概 5 个左右的日常更新搬运号，更新完后更新日期，新活动游戏号定位到活动起始时间   一定时间一次性  