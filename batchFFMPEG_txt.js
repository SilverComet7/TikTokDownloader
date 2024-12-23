const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// 获取当前脚本所在的目录
const scriptDir = path.dirname(__filename);

// 定义视频文件夹路径
const videoFolderPath = path.join(scriptDir, 'UID3127478488414035_Camellia__发布作品');
const musicFilePath = path.join(scriptDir, './music.mp3'); // 音乐文件路径
const endingFilePath = path.join(scriptDir, './点赞关注9：16.mp4'); // 片尾文件路径
const gameFragmentFilePath =  

// 打印路径以供调试
console.log("videoFolderPath:", videoFolderPath);
console.log("musicFilePath:", musicFilePath);
console.log("endingFilePath:", endingFilePath);

// 检查文件是否存在
function checkFileExists(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(`文件不存在: ${filePath}`);
        process.exit(1);
    }
}

checkFileExists(musicFilePath);
checkFileExists(endingFilePath);

// 读取文件夹内的所有文件
fs.readdir(videoFolderPath, (err, files) => {
    if (err) {
        return console.error('无法扫描目录: ' + err);
    }

    // 遍历文件
    files.forEach(file => {
        // 获取文件的完整路径
        const filePath = path.join(videoFolderPath, file);

        // 检查是否为视频文件（这里假设视频文件扩展名为.mp4）
        if (path.extname(file).toLowerCase() === '.mp4') {
            // 获取文件名和扩展名
            const fileName = path.basename(file, path.extname(file));
            const fileExt = path.extname(file);

            // 定义中间文件路径
            const tempVideoPath = path.join(videoFolderPath, `${fileName}_temp${fileExt}`);
            // 定义合并音乐后的文件路径
            const musicVideoPath = path.join(videoFolderPath, `${fileName}_music${fileExt}`);
            // 定义最终输出文件路径
            const finalVideoPath = path.join(videoFolderPath, `${fileName}_final${fileExt}`);
            // 定义 filelist.txt 路径
            const filelistPath = path.join(videoFolderPath, `${fileName}_filelist.txt`);

            // 步骤1：禁音合并后的视频并截取1秒后的所有画面
            const command1 = `ffmpeg -ss 1 -i "${filePath}" -c:v copy -an "${tempVideoPath}"`;

            console.log("🚀 ~ fs.readdir ~ command1:", command1);
            
            exec(command1, (error, stdout, stderr) => {
                if (error) {
                    console.error(`执行命令时出错: ${error.message}`);
                    console.error(`FFmpeg标准错误输出: ${stderr}`);
                    return;
                }
                if (stderr) {
                    console.warn(`FFmpeg警告输出: ${stderr}`);
                }
                console.log(`成功生成禁音后的视频: ${tempVideoPath}`);
                console.log(`FFmpeg标准输出: ${stdout}`);

                // 步骤2：合并音乐素材
                const command2 = `ffmpeg -i "${tempVideoPath}" -i "${musicFilePath}" -c:v copy -map 0:v:0 -map 1:a:0 -shortest "${musicVideoPath}"`;

                exec(command2, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`执行命令时出错: ${error.message}`);
                        console.error(`FFmpeg标准错误输出: ${stderr}`);
                        return;
                    }
                    if (stderr) {
                        console.warn(`FFmpeg警告输出: ${stderr}`);
                    }
                    console.log(`成功生成最终视频: ${musicVideoPath}`);
                    console.log(`FFmpeg标准输出: ${stdout}`);

                    // 步骤3：生成 filelist.txt
                    const filelistContent = `file '${musicVideoPath}'\nfile '${endingFilePath}'`;
                    fs.writeFileSync(filelistPath, filelistContent);

                    // 步骤4：合并视频和片尾
                    const command3 = `ffmpeg -f concat -safe 0 -i "${filelistPath}" -c copy "${finalVideoPath}"`;

                    exec(command3, (error, stdout, stderr) => {
                        if (error) {
                            console.error(`执行命令时出错: ${error.message}`);
                            console.error(`FFmpeg标准错误输出: ${stderr}`);
                            return;
                        }
                        if (stderr) {
                            console.warn(`FFmpeg警告输出: ${stderr}`);
                        }
                        console.log(`成功生成最终视频: ${finalVideoPath}`);
                        console.log(`FFmpeg标准输出: ${stdout}`);

                        // 删除中间文件
                        fs.unlink(tempVideoPath, (err) => {
                            if (err) {
                                console.error(`删除中间文件时出错: ${err.message}`);
                                return;
                            }
                            console.log(`成功删除中间文件: ${tempVideoPath}`);
                        });

                        fs.unlink(musicVideoPath, (err) => {
                            if (err) {
                                console.error(`删除中间文件时出错: ${err.message}`);
                                return;
                            }
                            console.log(`成功删除中间文件: ${musicVideoPath}`);
                        });

                        fs.unlink(filelistPath, (err) => {
                            if (err) {
                                console.error(`删除中间文件时出错: ${err.message}`);
                                return;
                            }
                            console.log(`成功删除中间文件: ${filelistPath}`);
                        });
                    });
                });
            });
        }
    });
});