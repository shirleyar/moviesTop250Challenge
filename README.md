# moviesTop250Challenge
Serivce that saves the movies the user has watched and returns the next movie to watch from the top 250 movies from idb.

URL: (Webtask)
https://wt-ecc23095b9cdb4fdab9ca8952aef045f-0.run.webtask.io/top250MoviesChallenge

###Endpoints

#####POST: /    
Initializes the service.
Must be first opertion performed.

#####PUT: /movie     
Inserts a movie to the watched list or updates an already watched movie.     
    
Body:    (all properties are mandatory)
```javascript
    {
        "name": "Big Hero 6",
        "year": 2014,
        "user_rating": 8.5
    }
```
Headers:
```javascript
    {
        "contect-type": "application/json",
    }
```

##### GET: /movie/:name/year/:year
Returns a watched movie by its name (string) an year (integer).

##### GET: /movies
Returns the entire watched movies list.

##### GET: /movie/next
Returns the next movie to watch according to the top 250 movies of Imdb,
