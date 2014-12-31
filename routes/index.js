var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', { title: 'Inner Sphere map', analytics: {trackingId: 'UA-58114935-1' }});
});

module.exports = router;

process.on('uncaughtException', function (err) {
  console.log(err);
})