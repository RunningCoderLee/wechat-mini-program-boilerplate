import { series, dest, watch, src, parallel } from 'gulp'
import path from 'path'
import tap from 'gulp-tap'
import fs from 'fs'
import Fiber from 'fibers'
import mkdirp from 'mkdirp'
import colors from 'colors'
import ts from 'gulp-typescript'
import tsconfig from './tsconfig.json'
import sass from 'sass'
import postcss from 'postcss'
import px2rpx from 'wx-px2rpx'
import autoprefixer from 'autoprefixer'
const tsProject = ts.createProject('tsconfig.json')
const processors = [px2rpx()]

const paths = {
  root: path.resolve(__dirname),
  dist: path.resolve(__dirname, 'dist'),
  src: path.resolve(__dirname, 'src'),
}

const writeFile = (filePath, contents, cb) => {
  const dir = path.dirname(filePath)
  // 如果父级文件夹不存在则先创建文件夹
  mkdirp(dir, err => {
    if (err) {
      return cb(err)
    }

    fs.writeFileSync(filePath, contents, cb)
  })
}

const compileScss = file => {
  const dir = path.dirname(file.path)
  const fileName = path.basename(file.path, '.scss')
  const filePathRelativeToRoot = path.relative(paths.root, file.path)
  const filePathRelativeToSrc = path.relative(paths.src, dir)

  console.log('[编译文件]'.green.bold, filePathRelativeToRoot)

  sass.render(
    {
      file: file.path,
      sourceMap: true,
      fiber: Fiber,
      // outFile: `${dir}/${fileName}.css`,
    },
    (err, result) => {
      if (!err) {
        console.log('[编译完成]'.green.bold, filePathRelativeToRoot)

        const destFileName = `${path.resolve(paths.dist, filePathRelativeToSrc)}/${fileName}.wxss`

        postcss([px2rpx, autoprefixer({ browsers: ['last 5 version'] })])
          .process(result.css)
          .then(res => {
            writeFile(destFileName, res.toString())
            console.log('[写入文件]'.cyan.bold, destFileName)
          })
      } else {
        console.log('[编译失败]'.red.bold, err)
      }
    }
  )
}

export const compileScssTask = () => {
  return src(['./src/**/*.scss', '!./src/styles/**']).pipe(
    tap(file => {
      compileScss({
        path: file.path,
        contents: file.contents.toString(),
      })
    })
  )
}

const compileTSTask = () => {
  return tsProject
    .src()
    .pipe(tsProject())
    .js.pipe(dest('./dist/'))
}

const watcher = () => {
  // 监听 TS 文件
  watch(
    [...tsconfig.include, '!./node_modules/**', '!./_scripts/**'],
    { events: ['add', 'change'] },
    compileTSTask
  )

  // 监听 scss 文件
  watch(['./src/**/*.scss'], { events: ['add', 'change'] }, compileScssTask)

  // 监听 json 和 wxml 文件
  watch(['./src/**/*.json', './src/**/*.wxml'], { events: ['add', 'change'] }, moveTask)

  console.log('[监听更改]'.green.bold, '...')
}

export { watcher as watch }

export const moveTask = cb => {
  return src(['./src/**/*.json', './src/**/*.wxml']).pipe(dest('./dist/'))
}

export const build = cb => {
  series(parallel(compileTSTask, compileScssTask, moveTask))(() => {
    cb()
    console.log('[编译完成]'.green.bold, '恭喜你全部文件编译完成。')

    if (process.env.NODE_ENV === 'development') {
      watcher()
    }
  })
}

export default build
