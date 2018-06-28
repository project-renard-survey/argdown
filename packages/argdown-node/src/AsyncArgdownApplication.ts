"use strict";
import { cloneDeep, isArray, isString, isEmpty, isFunction, defaults, isObject } from "lodash";
import { ArgdownApplication, IArgdownRequest, IArgdownResponse, ArgdownPluginError } from "@argdown/core";
import { isAsyncPlugin } from "./IAsyncArgdownPlugin";
import * as path from "path";
import * as chokidar from "chokidar";
import * as glob from "glob";
import { promisify } from "util";
import * as requireUncached from "require-uncached";
import { readFile } from "fs";

const readFileAsync = promisify(readFile);

export class AsyncArgdownApplication extends ArgdownApplication {
  async runAsync(request: IArgdownRequest, response?: IArgdownResponse): Promise<IArgdownResponse> {
    let process: string[] = [];
    this.logger.setLevel("error");
    let resp: IArgdownResponse = response || {};
    const req = defaults({}, request);

    if (req) {
      if (req.logLevel) {
        this.logger.setLevel(req.logLevel);
      }
      if (req.process) {
        if (isArray(req.process)) {
          process = req.process;
        } else if (isString(req.process) && req.processes) {
          process = req.processes[req.process];
        }
      }
    }

    if (isEmpty(process)) {
      this.logger.log("error", "[AsyncArgdownApplication]: No processors to run.");
      return resp;
    }
    const exceptions: Error[] = [];
    resp.exceptions = exceptions;

    for (let processorId of process) {
      let cancelProcessor = false;
      let processor = this.processors[processorId];
      if (!processor) {
        this.logger.log("error", "[AsyncArgdownApplication]: Processor not found: " + processorId);
        continue;
      }
      this.logger.log("verbose", "[AsyncArgdownApplication]: Running processor: " + processorId);

      for (let plugin of processor.plugins) {
        if (isFunction(plugin.prepare)) {
          this.logger.log("verbose", "[AsyncArgdownApplication]: Preparing plugin: " + plugin.name);
          try {
            plugin.prepare(req, resp, this.logger);
          } catch (e) {
            e.processor = processorId;
            exceptions.push(e);
            cancelProcessor = true;
            this.logger.log("warning", `Processor ${processorId} canceled.`);
            break;
          }
        }
      }
      if (cancelProcessor) {
        break;
      }

      if (resp.ast && processor.walker) {
        try {
          processor.walker.walk(req, resp, this.logger);
        } catch (e) {
          e.processor = processorId;
          exceptions.push(e);
          this.logger.log("warning", `[ArgdownApplication]: Processor ${processorId} canceled.`);
          break;
        }
      }

      for (let plugin of processor.plugins) {
        this.logger.log("verbose", "[AsyncArgdownApplication]: Running plugin: " + plugin.name);
        try {
          if (isAsyncPlugin(plugin)) {
            await plugin.runAsync(req, resp, this.logger);
          } else if (isFunction(plugin.run)) {
            plugin.run(req, resp, this.logger);
          }
        } catch (e) {
          e.processor = processorId;
          this.logger.log("warning", `Processor ${processorId} canceled.`);
          exceptions.push(e);
          break;
        }
      }
    }
    if (req.logExceptions === undefined || req.logExceptions) {
      for (let exception of exceptions) {
        let msg = exception.stack || exception.message;
        if (exception instanceof ArgdownPluginError) {
          msg = `[${exception.processor}/${exception.plugin}]: ${msg}`;
        }
        this.logger.log("error", msg);
      }
    }
    return resp;
  }
  load = async (request: IArgdownRequest): Promise<IArgdownResponse[] | undefined> => {
    const inputGlob = request.inputPath || "./*.argdown";
    const ignoreFiles = request.ignore || [
      "**/_*", // Exclude files starting with '_'.
      "**/_*/**" // Exclude entire directories starting with '_'.
    ];

    if (request.logger && isFunction(request.logger.log) && isFunction(request.logger.setLevel)) {
      if (!this.defaultLogger) {
        this.defaultLogger = this.logger;
      }
      this.logger = request.logger;
    } else if (this.defaultLogger) {
      this.logger = this.defaultLogger;
    }

    if (!request.rootPath) {
      request.rootPath = process.cwd();
    }
    if (request.logLevel) {
      this.logger.setLevel(request.logLevel);
    }
    if (request.plugins) {
      for (let pluginData of request.plugins) {
        if (isObject(pluginData.plugin) && isString(pluginData.processor)) {
          this.addPlugin(pluginData.plugin, pluginData.processor);
        }
      }
    }
    if (request.input && !request.inputPath) {
      await this.runAsync(cloneDeep(request));
      return;
    }

    const $ = this;
    let absoluteInputGlob = path.resolve(request.rootPath, inputGlob);
    const loadOptions: chokidar.WatchOptions = {};
    if (ignoreFiles) {
      // error in WatchOptions type declaration: option is called "ignore", not "ignored":
      (<any>loadOptions).ignore = ignoreFiles;
    }
    if (request.watch) {
      const watcher = chokidar.watch(absoluteInputGlob, loadOptions);
      const watcherRequest = cloneDeep(request);
      watcherRequest.watch = false;

      watcher
        .on("add", path => {
          this.logger.log("verbose", `File ${path} has been added.`);
          watcherRequest.inputPath = path;
          $.load(watcherRequest);
        })
        .on("change", path => {
          this.logger.log("verbose", `File ${path} has been changed.`);
          watcherRequest.inputPath = path;
          $.load(watcherRequest);
        })
        .on("unlink", path => {
          this.logger.log("verbose", `File ${path} has been removed.`);
        });
    } else {
      let files: string[] = await new Promise<string[]>((resolve, reject) => {
        glob(absoluteInputGlob, loadOptions, (er: Error | null, files: string[]) => {
          if (er) {
            reject(er);
          }
          resolve(files);
        });
      });
      const promises = [];
      for (let file of files) {
        const requestForFile = cloneDeep(request);
        requestForFile.inputPath = file;
        promises.push(this.runAsync(requestForFile));
      }
      // Remove plugins added by request
      if (request.plugins) {
        for (let pluginData of request.plugins) {
          this.removePlugin(pluginData.plugin, pluginData.processor);
        }
      }
      return await Promise.all(promises);
    }
    return;
  };
  loadConfig = async (filePath: string): Promise<IArgdownRequest> => {
    let config: IArgdownRequest = {};
    filePath = filePath || "./argdown.config.json"; // json is default because it can be loaded asynchronously
    filePath = path.resolve(process.cwd(), filePath);
    const extension = path.extname(filePath);
    // We use non-blocking IO for JSON config files
    if (extension === ".json") {
      try {
        const buffer = await readFileAsync(filePath, "utf8");
        config = JSON.parse(buffer);
      } catch (e) {
        this.logger.log("verbose", "[AsyncArgdownApplication]: No config found: " + e.toString());
      }
    } else if (extension === ".js") {
      // For Js config files we have to used require-uncached which is synchronous
      try {
        let jsModuleExports = loadJSFile(filePath);
        if (jsModuleExports.config) {
          config = jsModuleExports.config;
        } else {
          // let's try the default export
          config = jsModuleExports;
        }
      } catch (e) {
        this.logger.log("verbose", "[AsyncArgdownApplication]: No config found: " + e.toString());
      }
    }
    return config;
  };
}
/**
 * Taken from eslint: https://github.com/eslint/eslint/blob/master/lib/config/config-file.js
 * Loads a JavaScript configuration from a file.
 * @param {string} filePath The filename to load.
 * @returns {Object} The configuration object from the file.
 * @throws {Error} If the file cannot be read.
 * @private
 */
const loadJSFile = (filePath: string) => {
  let absoluteFilePath = path.resolve(process.cwd(), filePath);
  try {
    return requireUncached(absoluteFilePath);
  } catch (e) {
    e.message = `Cannot read file: ${absoluteFilePath}\nError: ${e.message}`;
    throw e;
  }
};