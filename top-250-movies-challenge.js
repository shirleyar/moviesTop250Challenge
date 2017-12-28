var express = require('express');
var request = require('request');
var app     = express();
var Webtask = require('webtask-tools');
var mysql = require('mysql');
var bodyParser = require('body-parser');
var util = require('util');
var _ = require('lodash');
var imdbApi = require('imdb-api');
var bluebird = require('bluebird');

var connectionRecieved;
var statusMySql = 'down';
var pool;

app.use(bodyParser.json());

app.get('/init', function(req, res){
  if (statusMySql === 'up'){
    res.json({status:"Already up. Stop initializing."});
  } else {
    pool = mysql.createPool({
      connectionLimit: 20,
      host: 'sql11.freesqldatabase.com',
      user: 'sql11212380',
      password: 'ARJKJBntgp',
      database: 'sql11212380',
    });
    pool.getConnection(function(err, connection) {
      if (!err){
      console.log("MYSQL CONNECTED!");
      connectionRecieved = connection;
      statusMySql='up';
      res.json({
        status: statusMySql
      });
      } else {
      console.log("mysql error:" + err);
      res.status(500).json({
        status: statusMySql,
        error: error 
      });
    }
    });
  }
});

app.get('/movie/:name/year/:year', function(req, res){
    if (statusMySql !== 'up') {
      res.status(400).json ({
        error: "Service uninitialized"
      });
      return;
    }
    connectionRecieved.query('SELECT * FROM sql11212380.Watched_Movies WHERE name LIKE ? AND year = ?;',[req.params.name, req.params.year], function(error, results, fields) {
      if (error) {
        console.log('Error while querying DB: %j', error);
          res.status(500).json({
            error: error
          });
      } else {
        res.json(results[0]);
    }
    });
});

app.get('/all_watched', function(req, res){
  if (statusMySql !== 'up') {
      res.status(400).json ({
        error: "Service uninitialized"
      });
      return;
    }
    connectionRecieved.query( "SELECT * FROM sql11212380.Watched_Movies;", function(error, results, fields) {
  if (error) {
        console.log('Error while querying DB: %j', error);
          res.status(500).json({
            error: error
          });
      } else {
        res.json(results);
    }
  });
});

app.put('/movie', function (req, res){
  if (statusMySql !== 'up') {
      res.status(400).json ({
        error: "Service uninitialized"
      });
      return;
    }
    var connection = pool.getConnection(function(err, connection) {
    var now = new Date();
    var prepared = mysql.format('INSERT INTO sql11212380.Watched_Movies (name, year, user_rating, times_watched, date_last_watched) VALUES (?, ?, ?, ? ,?) ON DUPLICATE KEY UPDATE user_rating=?, times_watched=times_watched+1, date_last_watched= ?;', [req.body.name, req.body.year, req.body.user_rating, 1, now, req.body.user_rating, now]);
      connection.query(prepared, function (error, results, fields) {
      if (error) {
          console.log('Error while inserting to DB: %j', error);
            res.status(500).json({
              error: error
            });
        } else {
          connection.query('SELECT * FROM sql11212380.Watched_Movies WHERE name LIKE ? AND year = ?;',[req.body.name, req.body.year], function(error, results, fields) {
            if (error) {
            console.log('Error while querying DB: %j', error);
            res.status(500).json({
                error: error
            });
          } else {
            res.status(201).json(results[0]);
            }
        }); 
      }
    });
  });
});

app.get('/movie/next', function(req, res){
  if (statusMySql !== 'up') {
    res.status(400).json ({ error: "Service uninitialized"});
    return;
  }
  connectionRecieved.query('SELECT * FROM sql11212380.Watched_Movies;', function(error, results, fields) {
    if (error) {
      console.log('Error while querying DB: %j', error);
      res.status(500).json({error: error});
    } else {
        var watchedMovies = results;
        request.get({
          url: 'https://wt-ecc23095b9cdb4fdab9ca8952aef045f-0.run.webtask.io/imdb-top250-node'
        }, function(err, response) {
            if (err) {
              console.log(util.format("Error getting top 250: %j", err));
              res.status(500).json({error: err});
              return;
            } 
            var top250Movies = JSON.parse(response.body);
            var topUnWatchedMovies = _.filter(top250Movies, function(movie) {
              return !_.includes(watchedMovies, movie);});
            
            res.json (topUnWatchedMovies[0]);
      });
    }
  });
});


 module.exports = Webtask.fromExpress(app);