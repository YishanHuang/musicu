var express = require('express'),
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    methodOverride = require('method-override'),
    session = require('express-session'),
    passport = require('passport'),
    swig = require('swig'),
    SpotifyStrategy = require('./node_modules/passport-spotify/lib/passport-spotify/index').Strategy;


var FeedParser = require('feedparser')
  ,request = require('request');

var options = {
  normalize: false,
  addmeta: false,
  resume_saxerror: false
};

var req = request('https://news.google.com/news?cf=all&hl=en&pz=1&ned=us&output=rss&num=20')
  ,feedparser = new FeedParser(options);

req.setMaxListeners(50);

req.on('error', function (error) {
  // handle any request errors 
});
req.on('response', function (res) {
  var stream = this;
 
  if (res.statusCode != 200) return this.emit('error', new Error('Bad status code'));
 
  stream.pipe(feedparser);
});
 

feedparser.on('error', function(error) {
  // always handle errors 
});

var topTen = [];
var topTenLinks = [];
var topTenDates = [];

feedparser.on('readable', function() {
// This is where the action is! 
var stream = this
  , meta = this.meta // **NOTE** the "meta" is always available in the context of the feedparser instance 
  , item; 

while (item = stream.read()) {
   // console.log(item);
   topTenDates.push(item['rss:pubdate']['#']);
   topTenLinks.push(item['rss:link']['#']);
   topTen.push(item['rss:title']['#']);
};
// console.log(meta['rss:item'][0]);
});




var consolidate = require('consolidate');
var SpotifyWebApi = require('spotify-web-api-node');

var spotifyApi = new SpotifyWebApi({
  clientId : 'd459812234404252b100f44c0eaff91f',
  clientSecret : 'a0a23f769c4745698ce79419d4fc12f8',
  redirectUri : 'http://localhost:8888/callback'
});

var appKey = 'd459812234404252b100f44c0eaff91f';
var appSecret = 'a0a23f769c4745698ce79419d4fc12f8';

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session. Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing. However, since this example does not
//   have a database of user records, the complete spotify profile is serialized
//   and deserialized.
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});


// Use the SpotifyStrategy within Passport.
//   Strategies in Passport require a `verify` function, which accept
//   credentials (in this case, an accessToken, refreshToken, and spotify
//   profile), and invoke a callback with a user object.
passport.use(new SpotifyStrategy({
  clientID: 'd459812234404252b100f44c0eaff91f',
  clientSecret: 'a0a23f769c4745698ce79419d4fc12f8',
  callbackURL: 'http://localhost:8888/callback'
  },
  function(accessToken, refreshToken, profile, done) {
    // asynchronous verification, for effect...

    //*** We use this to solve the accesstoken problem
    spotifyApi.setAccessToken(accessToken);
    process.nextTick(function () {
      // To keep the example simple, the user's spotify profile is returned to
      // represent the logged-in user. In a typical application, you would want
      // to associate the spotify account with a user record in your database,
      // and return that user instead.
      return done(null, profile);
    });
  }));

var app = express();

// configure Express
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.use(cookieParser());
app.use(bodyParser());
app.use(bodyParser.urlencoded({ extended: true })); 
app.use(methodOverride());
app.use(session({ secret: 'keyboard cat' }));
// Initialize Passport!  Also use passport.session() middleware, to support
// persistent login sessions (recommended).
app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(__dirname + '/public'));

app.engine('html', consolidate.swig);

app.get('/', function(req, res){
  res.render('index.html', { user: req.user });
});

app.get('/home', function(req,res){
    // console.log(req.user);
    // top 100 daily 4hOKQuZbraPDIfaGbM3lKI
    // grab the first one as a surpise 
  spotifyApi.getPlaylist('spotify', '4hOKQuZbraPDIfaGbM3lKI')
  .then(function(data) {
   mySong =  data.body.tracks.items[0].track;
    console.log('Some information about this playlist',mySong);
    return mySong;
  }, function(err) {
    console.log('Something went wrong!', err);
  }).then(function(mySong){

	console.log(topTen);
	spotifyApi.getMyTopArtists({limit: 9, time_range: 'short_term'})
	.then(function(data){
	  myTopArtists = data.body.items;
	  res.render('index.html', { user: req.user,
	                             topArtists: myTopArtists,
	                           	song: mySong});
	});
});
  });


app.get('/account', ensureAuthenticated, function(req, res){
  // console.log(req.user);
    res.render('account.html', { user: req.user});
});


//search track function 
app.get('/search_track', function(req, res){
   spotifyApi.searchTracks(req.query.name)
    .then(function(data) {
      // console.log('Search by '+ req.query.name, data.body);
      // console.log(data.body.tracks.items);
      // console.log(req.user);
      res.render('search.html', { tracks:data.body.tracks.items, 
                                  user: req.user, 
                                  topics: topTen,
                                  links:  topTenLinks,
                                  dates: topTenDates});
      // res.render('search.html',{tracks: req.tracks.items.track.album});
    }, function(err) {
      console.error(err);
      res.render('search.html', {err: "You didn't search anything"});
    });
});

//search track function 
app.get('/search_playlists', function(req, res){
   spotifyApi.searchPlaylists(req.query.name)
    .then(function(data) {
      // console.log(data.body.playlists.items[0].uri);
      res.render('search.html', {playlist: data.body.playlists.items[0],
                                  topics: topTen,
                                  links:  topTenLinks,
                                  dates: topTenDates});
      // data.body.playlists.items.forEach(function(playlist){
      //   console.log(playlist.external_urls);
      // });
    });
});


// GET /auth/spotify
//   Use passport.authenticate() as route middleware to authenticate the
//   request. The first step in spotify authentication will involve redirecting
//   the user to spotify.com. After authorization, spotify will redirect the user
//   back to this application at /auth/spotify/callback
app.get('/auth/spotify',
  passport.authenticate('spotify', {scope: ['user-read-email', 'user-read-private','user-read-birthdate', 'user-top-read'], showDialog: true}),
  function(req, res){
// The request will be redirected to spotify for authentication, so this
// function will not be called.
});


// GET /auth/spotify/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request. If authentication fails, the user will be redirected back to the
//   login page. Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/callback',
  passport.authenticate('spotify', { failureRedirect: '/' }),
  function(req, res) {
    // authorizationCode = req.query.code;
    // // console.log(authorizationCode);
    res.redirect('/home');
  });

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

app.listen(8888);


// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed. Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login');
}
