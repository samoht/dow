
var app = require('http').createServer(handler)
var io = require('socket.io')(app);
var fs = require('fs');
var Convert = require('ansi-to-html');
var Docker = require('dockerode');
var xssFilters = require('xss-filters');
var url = require('url')

var docker = new Docker({socketPath: '/var/run/docker.sock'});
var convert = new Convert();

app.listen(8000);

var channels = []

function escape (html) {
  var text = document.createTextNode(html);
  var div = document.createElement('div');
  div.appendChild(text);
  return div.innerHTML;
};

function handler (req, res) {
  name = url.parse(req.url, true).path
  stream(name);
  fs.readFile(__dirname + '/index.html',
  function (err, data) {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading index.html');
    }
    res.writeHead(200);
    res.end(data);
  });
}

function stream (name) {
  container = name.substring(1)
  if (name in channels) {
    console.log("channel ", name, " already exists");
    return;
  } else {
    console.log("add new channel ", name);
    channels[name] = "busy";
    io.on('connection', function (socket) {
      docker.getContainer(container).logs({
        stdout: true,
        stderr: true,
        follow: true,
        tail: 1000,
      }, function (err, logStream) {
        if (err) {
          console.log(err);
          return;
        }
        logStream.setEncoding('utf8');
        logStream.on('data', function (chunk) {
          var escaped = convert.toHtml(xssFilters.inHTMLData(chunk).replace(/ /g, '&nbsp;<wbr>').replace(/\n/g, '<br>'));
          socket.emit(name, { html: escaped });
        });
      });
    })
  };
}