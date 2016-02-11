var express = require('express');
var path = require('path');
var app = express();

var port = process.env.PORT || 8080;
var static_path = path.join(__dirname, 'build');

app.use(express.static(static_path));
app.listen(port, function (err) {
  if (err) {
    console.log(err);
  }
  console.log('Listening at localhost:' + port);
});
