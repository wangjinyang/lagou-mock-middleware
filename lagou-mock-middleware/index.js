var request = require('request').defaults({jar: true});
var path = require('path');
var fs = require('fs');
var mockJsonDir;
function lagouMockMiddleware(config) {
    var mockServerConfig = config && config.mockServerConfig || {};
    mockJsonDir = config && config.mockJsonDir || '';
    return function(req, res, next) {
        var pathName = req.path;
        var body = req.body;
        var method = (req.method || 'GET').toLocaleUpperCase();
        var mockData = mockServerConfig[pathName] || false;
        var query = req.query;
        return renderMockData(mockData, method, query, body, res, next);
    };
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
