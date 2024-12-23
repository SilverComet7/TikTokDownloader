const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// 定义视频文件夹路径
const videoFolderPath = './';
const musicFilePath = './music.mp3'; // 假设音乐文件名为 music.mp3

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
            // 定义输出文件路径
            const finalVideoPath = path.join(videoFolderPath, `${fileName}_final${fileExt}`);

            // 步骤1：禁音原视频并截取2秒后的所有画面
            const command1 = `ffmpeg -i "${filePath}" -ss 2 -c:v copy -an "${tempVideoPath}"`;

            exec(command1, (error, stdout, stderr) => {
                if (error) {
                    console.error(`执行命令时出错: ${error.message}`);
                    console.error(`FFmpeg标准错误输出: ${stderr}`);
                    return;
                }
                if (stderr) {
                    console.warn(`FFmpeg警告输出: ${stderr}`);
                }
                console.log(`成功生成中间视频: ${tempVideoPath}`);
                console.log(`FFmpeg标准输出: ${stdout}`);

                // 步骤2：合并音乐素材
                const command2 = `ffmpeg -i "${tempVideoPath}" -i "${musicFilePath}" -c:v copy -map 0:v:0 -map 1:a:0 -shortest "${finalVideoPath}"`;

                exec(command2, (error, stdout, stderr) => {
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
                });
            });
        }
    });
});