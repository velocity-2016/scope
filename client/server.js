var express = require('express');
var http = require('http');
var httpProxy = require('http-proxy');
var HttpProxyRules = require('http-proxy-rules');
var url = require('url');

var app = express();

var BACKEND_HOST = process.env.BACKEND_HOST || 'localhost';
var WEBPACK_SERVER_HOST = process.env.WEBPACK_SERVER_HOST || 'localhost';

/************************************************************
 *
 * Express routes for:
 *   - app.js
 *   - app-terminal.js
 *   - index.html
 *
 *   Proxy requests to:
 *     - /api -> :4040/api
 *
 ************************************************************/


// Serve application file depending on environment
app.get(/(app|contrast-app|terminal-app|components-app|vendors).js/, function(req, res) {
  var filename = req.originalUrl;
  if (process.env.NODE_ENV === 'production') {
    res.sendFile(__dirname + '/build' + filename);
  } else {
    res.redirect('//' + WEBPACK_SERVER_HOST + ':4041/build' + filename);
  }
});

// Proxy to backend

var proxy = httpProxy.createProxy({
  ws: true,
  target: 'http://' + BACKEND_HOST + ':4040'
});

proxy.on('error', function(err) {
  console.error('Proxy error', err);
});

app.all('/api*', proxy.web.bind(proxy));

// Serve index page

app.use(express.static('build'));


/*************************************************************
 *
 * Webpack Dev Server
 *
 * See: http://webpack.github.io/docs/webpack-dev-server.html
 *
 *************************************************************/

if (process.env.NODE_ENV !== 'production') {
  var webpack = require('webpack');
  var WebpackDevServer = require('webpack-dev-server');
  var config = require('./webpack.local.config');

  new WebpackDevServer(webpack(config), {
    publicPath: 'http://' + WEBPACK_SERVER_HOST + ':4041/build/',
    hot: true,
    noInfo: true,
    historyApiFallback: true,
    stats: { colors: true }
  }).listen(4041, '0.0.0.0', function (err, result) {
    if (err) {
      console.log(err);
    }
  });
}


/******************
 *
 * Express server
 *
 *****************/

var port = process.env.PORT || 4042;
var server = app.listen(port, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Scope UI listening at http://%s:%s', host, port);
});

server.on('upgrade', proxy.ws.bind(proxy));


/*************************************************************
 *
 * path proxy server
 *
 *************************************************************/

var proxyRules = new HttpProxyRules({
  rules: {
    '/scoped/': 'http://localhost:' + port
  }
});

var pathProxy = httpProxy.createProxy({ws: true});
pathProxy.on('error', function(err) { console.error('path proxy error', err); });
var pathProxyPort = port + 1;
const proxyPathServer = http.createServer(function(req, res) {
  var target = proxyRules.match(req);
  if (!target) {
    res.writeHead(500, {'Content-Type': 'text/plain'});
    res.end('No rules matched! Check out /scoped/');
    return;
  }
  return pathProxy.web(req, res, {target: target});
}).listen(pathProxyPort, function() {
  var pathProxyHost = proxyPathServer.address().address;
  console.log('Scope Proxy Path UI listening at http://%s:%s/scoped/',
              pathProxyHost, pathProxyPort);
});

proxyPathServer.on('upgrade', function(req, socket, head) {
  var target = proxyRules.match(req);
  if (target) {
    return pathProxy.ws(req, socket, head, {target: target});
  }
});
