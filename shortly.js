var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(session({
  secret: 'secret'
}));


var authentication = function(req, res, next) {
  //If the user exists
  if (req.session.user) {
    return next();
  } else {
    //redirect the user to the login page
    res.redirect('/login');
  }
};
 
app.get('/', authentication,
function(req, res) {
  res.render('index');
});

app.get('/create', authentication,
function(req, res) {
  res.render('index');
});

app.get('/links', authentication,
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.status(200).send(links.models);
  });
});

app.post('/links', 
function(req, res) {
  var uri = req.body.url;

  if (uri.indexOf('http://') === - 1) {
    uri = 'http://' + uri;
  }

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.sendStatus(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.status(200).send(found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('this is the error here <------------', uri);
          console.log('Error reading URL heading: ', err);
          return res.sendStatus(404);
        }

        Links.create({
          url: uri,
          title: title,
          baseUrl: req.headers.origin
        })
        .then(function(newLink) {
          res.status(200).send(newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.get('/login',
function(req, res) {
  res.render('login');
});

app.post('/login', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;
  db.knex('users')
    .where('username', '=', username)
    .then(function(user) {
      if (!user[0]) {
        res.redirect('/login');
      } else if (user[0].password === password) {
      //Compare password on the database to supplied password
        req.session.user = user;
        res.redirect('/');
      } else {
        res.redirect('/login');
      }
    });
});

app.get('/signup', function(req, res) {
  res.render('signup');
});

app.post('/signup', function(req, res, next) {
  var user = new User({
    'username': req.body.username,
    'password': req.body.password
  }).save()
  .then(function() {
    req.session.user = user;
    res.redirect('/');
  });
});

app.post('/logout', function(req, res, next) {
  req.session.user = '';
  res.redirect('/login');
});

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
