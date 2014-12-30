var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', { title: 'Inner Sphere map' });
});

module.exports = router;

process.on('uncaughtException', function (err) {
  console.log(err);
})