const GraphHelpers = require('webpack/lib/GraphHelpers');

module.exports = class SplitModuleMultipleChunksPlugin {
  constructor(options) {
    this.options = SplitModuleMultipleChunksPlugin.normalizeOptions(options || {});
  }

  static normalizeOptions(cacheGroups) {
    return {
      getCacheGroupModule: SplitModuleMultipleChunksPlugin.normalizeModuleCacheGroups(cacheGroups)
    };
  }

  static normalizeModuleCacheGroups(cacheGroups) {
    if (cacheGroups && typeof cacheGroups === 'object') {
      const fn = (module) => {
        let matchCacheGroup;
        Object.keys(cacheGroups).find((cacheGroupKey) => {
          const cacheGroup = cacheGroups[cacheGroupKey];
          if (SplitModuleMultipleChunksPlugin.checkTest(cacheGroup.test, module)) {
            matchCacheGroup = cacheGroup;
          }
          return null;
        });
        return matchCacheGroup;
      };
      return fn;
    }
    const fn = () => { };
    return fn;
  }

  static checkTest(test, module) {
    if (test === undefined) {return true;}
    if (typeof test === 'function') {
      if (test.length !== 1) {
        return test(module, module.getChunks());
      }
      return test(module);
    }
    if (typeof test === 'boolean') {return test;}
    if (typeof test === 'string') {
      if (
        module.nameForCondition
        && module.nameForCondition().startsWith(test)
      ) {
        return true;
      }
      const chunks = module.chunksIterable;
      return chunks.some((chunk) => chunk.name && chunk.name.startsWith(test));
    }
    if (test instanceof RegExp) {
      if (module.nameForCondition && test.test(module.nameForCondition())) {
        return true;
      }
      const chunks = module.chunksIterable;
      return chunks.some((chunk) => chunk.name && test.test(chunk.name));
    }
    return false;
  }

  apply = (compiler) => {
    compiler.hooks.thisCompilation.tap('SplitModuleMultipleChunksPlugin', (compilation) => {
      let alreadyOptimized = false;
      compilation.hooks.unseal.tap('SplitModuleMultipleChunksPlugin', () => {
        alreadyOptimized = false;
      });
      compilation.hooks.afterOptimizeChunks.tap('SplitModuleMultipleChunksPlugin', () => {
        if (alreadyOptimized || compilation.chunks.length < 2) {return;}
        // module.nameForCondition
        alreadyOptimized = true;
        const moduleSetInfoChunk = new Map();
        const iteratorDependency = (currentModule, dep) => {
          // We skip Dependencies without Reference
          const ref = compilation.getDependencyReference(currentModule, dep);
          if (!ref) {
            return;
          }
          // 跳过没有module 的依赖
          const refModule = ref.module;
          if (!refModule) {
            return;
          }
          if (ref.weak) {
            return;
          }
          // eslint-disable-next-line consistent-return
          return refModule;
        };
        // 添加chunk
        const addChunksToSet = (moduleBelongChunks, chunks) => {
          chunks.forEach((chunk) => {
            moduleBelongChunks.add(chunk);
          });
        };

        // 通过名称获取chunk
        const getChunksByName = (chunkNames) => {
          const filterChunks = [];
          compilation.chunks.forEach((chunk) => {
            // chunkNames 为字符串
            if (typeof chunkNames === 'string' && chunkNames === chunk.name) {
              filterChunks.push(chunk);
            }
            // chunkNames 为数组
            if (Array.isArray(chunkNames) && chunkNames.includes(chunk.name)) {
              filterChunks.push(chunk);
            }
          });
          return filterChunks;
        };
        // 获取当前module 优化后应该归属于那个chunk
        const getAfterOptimizeBelongChunk = (cacheGroupModule) => {
          if (!cacheGroupModule) {return new Set();}
          const moduleBelongChunks = new Set();
          compilation.modules.forEach((module) => {
            if (module.dependencies) {
              module.dependencies.forEach((dep) => {
                // module 依赖的chunk 就是优化后要放入的chunk
                const depModule = iteratorDependency(module, dep);
                if (SplitModuleMultipleChunksPlugin.checkTest(cacheGroupModule.test, depModule)) {
                  // 强制配置该module 属于哪个chunk
                  if (typeof cacheGroupModule.chunks === 'string' || Array.isArray(cacheGroupModule.chunks)) {
                    addChunksToSet(moduleBelongChunks, getChunksByName(cacheGroupModule.chunks));
                  } else if (SplitModuleMultipleChunksPlugin.checkTest(cacheGroupModule.test, module)) {
                    // TODO
                    // 这种情况是一个index 文件导出当前文件夹下面的文件 如果匹配到这个index 文件
                  } else {
                    addChunksToSet(moduleBelongChunks, module.getChunks());
                  }
                }
              });
            }
          });
          return moduleBelongChunks;
        };
        // 查找每个module 所属的chunk 并存放到map 里
        compilation.modules.forEach((module) => {
          const cacheGroupModule = this.options.getCacheGroupModule(module);
          if (cacheGroupModule) {
            const moduleBelongChunks = getAfterOptimizeBelongChunk(cacheGroupModule);
            moduleBelongChunks.size > 0 && moduleSetInfoChunk.set(module, moduleBelongChunks);
          }
        });
        Array.from(moduleSetInfoChunk.entries()).forEach(([module, moduleBelongChunks]) => {
          const disconnectChunks = module && module.getChunks();
          Array.isArray(disconnectChunks) && disconnectChunks.forEach((chunk) => {
            GraphHelpers.disconnectChunkAndModule(chunk, module);
          });
          moduleBelongChunks.forEach((chunk) => {
            GraphHelpers.connectChunkAndModule(chunk, module);
          });
        });

        const removeChunkSet = [];
        // 优化去除没有module的chunk
        compilation.chunks.forEach((chunk) => {
          const modules = chunk.getModules();
          if (modules?.length === 0) {
            compilation.chunkGroups.forEach((chunkGroup) => {
              chunkGroup.removeChunk(chunk);
              chunk.removeGroup(chunkGroup);
              removeChunkSet.push(chunk);
            });
          }
        });
        // 移除没用的chunk
        compilation.chunks = compilation.chunks.filter((chunk) => !removeChunkSet.includes(chunk));
      });
    });
  }
};
