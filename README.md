# 0.0.1
** 对于拆包优化 其实 webpack 内置的 splitChunks 已经非常优秀并且能满足 99.9% 的应用场景
但是对于一些特殊的场景其实还是需要我们自己手动实现的、比如我们同一个文件被多个 chunk 用到了 如果把这个文件打包到公用 chunk 里, 那当一个页面没有用到改文件的时候又会造成资源浪费。最好的解决办法就是将这个文件拆分到对应使用到它的 chunk 中、节省文件资源开销。

** 所以这里 SplitModuleMultipleChunksPlugin 提供的功能就是将一个文件拆分到不同的 chunk  中, 这个在webpack 现有的解决方案中是没有的。

**  使用方式
    const SplitModuleMultipleChunksPlugin = require('split-module-multiple-chunks-plugin');
     plugins: [  
        new SplitModuleMultipleChunksPlugin({  
          MultiTabs: {  
            name: 'MultiTabs',  
            test(mod) {  
              const basePath = 'components/common/MultiTabs/';  
              // 需要拆分的文件  
              const filterFileNames = ['index', 'MultiTabsContainer',   'multiTabsAutomaticGet', 'TabVisibilitySensor',   'formatThreeDimensionalMultiTab']  
              return filterFileNames.some(fileName => mod?.resource?.includes(`${basePath}${fileName}`));  
            },  
            chunks: ['h5-MultiTabs', 'online-MultiTabs'] // 需要拆分到对应的chunk  
          }  
        })  
     ]  
