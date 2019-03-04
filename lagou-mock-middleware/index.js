var path = require('path');
var fs = require('fs');
var request = require('request').defaults({jar: true});
var chokidar = require('chokidar');
var moment = require('moment');

var purgeCache = require('./remove-require-cache');

var configChangeTimer
var mockJsonDir;
var mockServerConfig;
function lagouMockMiddleware(configPath, exculdeUrlList) {
    initConfigByArg(configPath)
    watchConfigChange(configPath)
    return function(req, res, next) {
        if (
            exculdeUrlList.some(function(item) {
                return req.url.indexOf(item) > -1;
            })
        ) {
            next();
            return;
        }
        var pathName = req.path;
        var body = req.body;
        var method = (req.method || 'GET').toLocaleUpperCase();
        var mockData = mockServerConfig[pathName] || false;
        var query = req.query;
        return renderMockData(mockData, method, query, body, res, next);
    };
}

function initConfigByArg(configPath){
    var config = {};
    try{
        config = require(configPath)
        mockServerConfig = config && config.mockServerConfig || {};
        mockJsonDir = config && config.mockJsonDir || '';
        console.log('mock data update success ' + new moment().format('YYYY-MM-DDThh:mm:ss'))
    }
    catch(e){
        console.log(e)
    }
    
}

function watchConfigChange(configPath){
    var watcher = chokidar.watch(configPath);
    watcher
        .on('change', function(){
            if(configChangeTimer){
                clearTimeout(configChangeTimer)
            }
            configChangeTimer = setTimeout(function(){
                purgeCache(configPath);
                initConfigByArg(configPath)
            }, 3000)
        })
}

function renderMockData(mockData, method, query, body, res, next) {
    if (mockData) {
        var mockDataType = Object.prototype.toString.call(mockData);
        if (mockDataType === '[object String]') {
            var pattern = /^((https|http|ftp|rtsp|mms)?:\/\/)[^\s]+/;
            var extend = path.extname(mockData);
            if (extend === '.html') {
                return res.redirect(mockData);
            }
            else if (pattern.test(mockData)) {
                request(mockData, function (requestError, requestResponse, requestBody) {
                    if (requestError) {
                        return res.json('get http request error: url' + mockData);
                    }
                    return res.json(JSON.parse(requestBody));
                });
            }
            else if (extend === '.json') {
                if (!path.isAbsolute(mockJsonDir)) {
                    return res.json('mockJsonDir should be a absolute path');
                }
                try {
                    var mockJsonPath = path.join(mockJsonDir, mockData);
                    return res.json(JSON.parse(fs.readFileSync(mockJsonPath).toString()));
                }
                catch (e) {
                    return res.json('mock json file not exist');
                }

            }
            return res.json(mockData);
        }
        else if (mockDataType === '[object Object]') {
            var methodData = mockData[method] || false;
            if (methodData) {
                return renderMockData(methodData, method, query, body, res, next);
            }
            return res.json(mockData);
        }
        else if (mockDataType === '[object Function]') {
            return res.json(mockData(query, body));
        }
        else {
            return res.json(mockData);
        }
    }
    return next();
}

module.exports = lagouMockMiddleware;
