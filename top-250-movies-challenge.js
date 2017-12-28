var express = require('express');
var request = require('request');
var app = express();
var Webtask = require('webtask-tools');
var mysql = require('mysql');
var bodyParser = require('body-parser');
var util = require('util');
var _ = require('lodash');
var httpStatusCodes = require('http-status-codes');

var connectionRecieved;
var pool;

var constants = {
  UP: 'up',
  DOWN: 'down',
  STOP_INIT: "Already up. Stop initializing.",
  CONNECTION_LIMIT: 20,
  CONNECTED: "MYSQL CONNECTED!",
  MYSQL_LOG_ERROR: "mysql error:%j",
  ERROR_UNINITIALIZED: "Service uninitialized",
  MYSQL_QUERY_SINGLE_WATCHED: 'SELECT * FROM sql11212380.Watched_Movies WHERE name LIKE ? AND year = ?;',
  MYSQL_QUERY_ALL_WATCHED:"SELECT * FROM sql11212380.Watched_Movies;",
  MYSQL_QUERY_INSERT_WATCHED: 'INSERT INTO sql11212380.Watched_Movies (name, year, user_rating, times_watched, date_last_watched) VALUES (?, ?, ?, ? ,?) ON DUPLICATE KEY UPDATE user_rating=?, times_watched=times_watched+1, date_last_watched= ?;',
  ERROR_SOMETHING_WRONG: {error: "Something Went wrong. Check logs"},
  TOP_250_URL: 'https://wt-ecc23095b9cdb4fdab9ca8952aef045f-0.run.webtask.io/imdb-top250-node',
  TOP_250_ERROR: "Error getting top 250: %j",
  FIRST_MOVIE_YEAR: 1890,
  HEADER_CONTENT_TYPE: "application/json",
  HEADER_CONTENT_TYPE_NAME: 'content-type',
  ERROR_VALIDATION: "At least one parameter is invalid."
};

var statusMySql = constants.DOWN;

app.use(bodyParser.json());

app.post('/init', function(req, res){
  if (statusMySql === constants.UP){
    res.json({status: constants.STOP_INIT});
  } else {
     var secrets = req.webtaskContext.data;
    pool = mysql.createPool({
      connectionLimit: constants.CONNECTION_LIMIT,
      host: secrets.mySqlHost,
      user: secrets.mySqlUser,
      password: secrets.mySqlPassword,
      database: secrets.mySqlDb,
    });
    pool.getConnection(function(err, connection) {
      if (!err){
      console.log(constants.CONNECTED);
      connectionRecieved = connection;
      statusMySql=constants.UP;
      res.json({
        status: statusMySql
      });
      } else {
      console.log(util.format(constants.MYSQL_LOG_ERROR, err));
      res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).json({
        status: statusMySql,
        error: error 
      });
    }
    });
  }
});

function blockIfNotInitialized(res) {
   if (statusMySql !== constants.UP) {
      res.status(httpStatusCodes.BAD_REQUEST).json ({
        error: constants.ERROR_UNINITIALIZED
      });
      return true;
    }
    return false;
}

app.get('/movie/:name/year/:year', function(req, res){
    if (blockIfNotInitialized(res)){
    return;
  }
    connectionRecieved.query(constants.MYSQL_QUERY_SINGLE_WATCHED,
      [req.params.name, req.params.year], 
      function(error, results, fields) {
       if (error) {
        console.log(util.format(constants.MYSQL_LOG_ERROR, error));
          res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).json({
            error: error
          });
      } else {
        _.isEmpty(results) ? res.status(httpStatusCodes.NOT_FOUND).json({}): res.json(results[0]);
      }
    });
});

app.get('/movies', function(req, res){
  if (blockIfNotInitialized(res)){
    return;
  }
    connectionRecieved.query(constants.MYSQL_QUERY_ALL_WATCHED, function(error, results, fields) {
  if (error) {
        console.log(util.format(constants.MYSQL_LOG_ERROR, error));
          res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).json({error: error});
      } else {
        res.json(results);
    }
  });
});

function isValidParameters (body, contentType) {
  var valid = true;
  if (_.isEmpty(body.name) || 
      !_.isNumber(body.year) || body.year >= (new Date()).getFullYear() || body.year < constants.FIRST_MOVIE_YEAR  ||
      !_.isNumber(body.user_rating) || body.user_rating >= 10 || body.user_rating < 0 ||
      contentType!== constants.HEADER_CONTENT_TYPE) {
        return !valid;
      }
    return valid;
}

app.put('/movie', function (req, res){
  if (blockIfNotInitialized(res)){
    return;
  }
  var body = req.body;
  console.log(req);
  if (!isValidParameters(body, req.get(constants.HEADER_CONTENT_TYPE_NAME))) {
    console.log(util.format("%s \n body:%j \n headers: %j",constants.ERROR_VALIDATION, body, headers));
    res.status(httpStatusCodes.BAD_REQUEST).json({error: constants.ERROR_VALIDATION});
    return;
  }
  var connection = pool.getConnection(function(err, connection) {
  var now = new Date();
  var prepared = mysql.format(constants.MYSQL_QUERY_INSERT_WATCHED,
      [_.startCase(req.body.name.toLowerCase()), req.body.year, req.body.user_rating, 1, now, req.body.user_rating, now]);
    connection.query(prepared, function (error, results, fields) {
      if (error) {
          console.log(util.format(constants.MYSQL_LOG_ERROR, error));
            res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).json({error: error});
        } else {
          connection.query(constants.MYSQL_QUERY_SINGLE_WATCHED,[req.body.name, req.body.year], function(error, results, fields) {
            if (error) {
            console.log(util.format(constants.MYSQL_LOG_ERROR, error));
            res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).json({error: error});
          } else {
            _.isEmpty(results) ? res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).json(constants.ERROR_SOMETHING_WRONG) : res.json(results[0]);
            }
        }); 
      }
    });
  });
});

app.get('/movie/next', function(req, res){
  if (blockIfNotInitialized(res)){
    return;
  }
  connectionRecieved.query(constants.MYSQL_QUERY_ALL_WATCHED, function(error, results, fields) {
    if (error) {
      console.log(util.format(constants.MYSQL_LOG_ERROR, error));
      res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).json({error: error});
    } else {
        var watchedMovies = results;
        request.get({
          url: constants.TOP_250_URL
        }, function(err, response) {
            if (err) {
              console.log(util.format(constants.TOP_250_ERROR, err));
              res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).json({error: err});
              return;
            } 
            try {
            var top250Movies = JSON.parse(response.body);
            var topUnWatchedMovies = _.filter(top250Movies, function(movie) {
              return !watchedMovies.find(function(watchedMovie){
                return movie.name.toLowerCase() === watchedMovie.name.toLowerCase() && movie.year=== watchedMovie.year.toString();
              })});
            res.json (topUnWatchedMovies[0] || {});
            } catch (error) {
                console.log(error);
                res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).json(constants.ERROR_SOMETHING_WRONG);
            }
      });
    }
  });
});

 module.exports = Webtask.fromExpress(app);