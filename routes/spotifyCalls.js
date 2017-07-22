/* jshint esversion: 6 */
const express = require('express');
const router = express.Router();
const User = require("../models/user");
const ensureLogin = require("connect-ensure-login");
const Song = require("../models/song");
const dotenv = require("dotenv").config();
const axios = require("axios");
const SpotifyWebApi = require('spotify-web-api-node');

// Create the api object with the credentials
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_API_CLIENTID,
  clientSecret: process.env.SPOTIFY_API_CLIENTSECRET
});

// Retrieve an access token.
spotifyApi.clientCredentialsGrant()
  .then(function (data) {
    console.log('The access token expires in ' + data.body['expires_in']);
    console.log('The access token is ' + data.body['access_token']);

    // Save the access token so that it's used in future calls
    spotifyApi.setAccessToken(data.body['access_token']);
  }, function (err) {
    console.log('Something went wrong when retrieving an access token', err);
  });

// Function to parse the songs (NOT REPEAT SONGS)
function parseSongs(myArray) { // It receives an array of objects
  let returnArray = [];
  for (var i = 0; i < myArray.length; i++) {
    var push = true;
    for (var j = 0; j < myArray.length; j++) {
      if (i !== j) {
        if (myArray[i].name === myArray[j].name) {
          if (returnArray.indexOf(myArray[i]) !== -1 || returnArray.indexOf(myArray[j]) !== -1) {
            push = false;
          }
        }
      }
    }
    if (push) {
      returnArray.unshift(myArray[i]);
    }
  }
  return returnArray;
}

function checkDuplicateLists(database, add) {
  for (var i = 0; i < database.length; i++) {
    if (database[i].name === add.name) {
      database = database.splice(i, 1);
      return true;
    }
  }
  return false;
}


// Retrieve information about the song the user searches
router.get("/getSong", (req, res, next) => {
  let search = req.query.song;
  spotifyApi.searchTracks(search)
    .then(function (data) {
      // Array which will have objects with the information needed about the song
      let allSongs = [];
      let result = data.body.tracks.items;
      result.forEach((element) => {
        // If we can play the song
        if (element.preview_url) {
          // The object with the information needed about the song
          let myObjectSong = {};
          // Add all the information to the objects
          myObjectSong.preview_url = element.preview_url;
          myObjectSong.id = element.id;
          myObjectSong.name = element.name;

          // information about the artist

          let arrayArtists = [];
          element.artists.forEach((artist) => {
            let objectArtist = {};
            objectArtist.name = artist.name;
            objectArtist.id = artist.id;
            arrayArtists.unshift(objectArtist);
          });
          myObjectSong.artists = arrayArtists;

          // Get an image for the artist
          let myImage = element.album.images[0].url;
          myObjectSong.image = myImage;

          // Push the object to the array<
          allSongs.unshift(myObjectSong);
        }
      });
      allSongs = parseSongs(allSongs);
      res.render("searchresults", {
        allSongs,
        username: req.user.username
      });
    }, function (err) {
      return next(err);
    });
});

//do post
router.post("/favourites/new", ensureLogin.ensureLoggedIn(), (req, res, next) => {
  let username = req.user.username;
  let action = "added to";
  const songObject = {
    name: req.body.info.songName,
    image: req.body.info.songImage,
    id_song: req.body.info.songId,
    preview_url: req.body.info.songPreviewUrl,
    artists: [req.body.songArtists],
    artist_id: req.body.info.artistId,
    artist_name: req.body.info.artistName,
    artist_bio: req.body.info.artistBio,
    artist_location: req.body.info.artistLocation,
    artist_locationLabel: req.body.info.artistLocationLabel
  };
  let myFav = req.user.favourites;
  if (!checkDuplicateLists(myFav, songObject)) {
    myFav.unshift(songObject);
  } else {
    action = "deleted from";
  }


  // Instead of updating the username, update the favourites
  User.findOneAndUpdate({
    username
  }, {
    $set: {
      favourites: myFav
    }
  }, (err, user) => {
    if (err) {
      return next(err);
    } else {
      if (action === "added to") {
        res.end('{"success" : "Updated Successfully", "status" : 200, "action": "added to"}');
      } else {
        res.end('{"success" : "Updated Successfully", "status" : 200, "action": "deleted from"}');
      }
    }
  });
});

router.post("/queue/new", ensureLogin.ensureLoggedIn(), (req, res, next) => {
  var action = true;
  const songObject = {
    name: req.body.info.songName,
    image: req.body.info.songImage,
    id_song: req.body.info.songId,
    preview_url: req.body.info.songPreviewUrl,
    artists: [req.body.songArtists],
    artist_id: req.body.info.artistId,
    artist_name: req.body.info.artistName,
    artist_bio: req.body.info.artistBio,
    artist_location: req.body.info.artistLocation,
    artist_locationLabel: req.body.info.artistLocationLabel
  };
  if (!checkDuplicateLists(req.session.myQueue, songObject)) {
    req.session.myQueue.unshift(songObject);
  } else {
    action = false;
  }
  req.session.save();
  if (action) {
    res.end('{"success" : "Updated Successfully", "status" : 200, "action": "added to"}');
  } else {
    res.end('{"success" : "Updated Successfully", "status" : 200, "action": "deleted from"}');
  }
});

function parseArtists(myArray) {
  let returnArray = [];
  for (var i = 0; i < myArray.length; i++) {
    returnArray.unshift(parseSongs(myArray[i]));
  }
  return returnArray;
}

router.get("/followed",  ensureLogin.ensureLoggedIn(), (req, res, next) => {
  let username = req.user.username;
  let allAlbums = [];
  User.findOne({
    username
  }, (err, user) => {
    let followingArtists = user.artists;
    if (followingArtists.length === 0) {
      res.render("followed", {
        username: req.user.username,
        allAlbums
      });
    } else {
      var promises = [];
      followingArtists.forEach((artist) => {
        promises.push(
          spotifyApi.getArtistAlbums(artist)
          .then(function (data) {
            let myAlbum = [];
            let result = data.body.items;
            result.forEach((element) => {
              let myObject = {};
              myObject.image = element.images[0].url;
              myObject.name = element.name;
              myObject.id = element.id;
              myAlbum.unshift(myObject);
            });
            allAlbums.unshift(myAlbum);
          }, function (err) {
            return next(err);
          }));
      });
      axios.all(promises).then(function (data) {
        res.render("followed", {
          username: req.user.username,
          allAlbums
        });
      });
    }
  });
});



router.get("/followed/individual", ensureLogin.ensureLoggedIn(), (req, res, next) => {
  let albumId = req.query.albumId;
  let tracksArray = [];
  spotifyApi.getAlbumTracks(albumId, {
      limit: 10,
      offset: 1
    })
    .then(function (data) {
      let result = data.body.items;
      result.forEach((el) => {
        if (el.preview_url) {
          let myObject = {};
          myObject.name = el.name;
          myObject.previewUrl = el.preview_url;
          myObject.id = el.id;
          tracksArray.unshift(myObject);
        }
      });
      res.render("songsalbum", {
        tracksArray,
        username: req.user.username
      });
    }, function (err) {
      return next(err);
    });
});


router.post("/artist/new",  ensureLogin.ensureLoggedIn(), (req, res, next) => {
  let id_artist = req.body.info.artistId;
  let username = req.user.username;
  let action = "following";

  let myArtists = req.user.artists;
  if (myArtists.indexOf(id_artist) !== -1) {
    myArtists.splice(myArtists.indexOf(id_artist), 1);
    action = "unfollowing";
  } else {
    myArtists.unshift(id_artist);
  }

  // Instead of updating the username, update the favourites
  User.findOneAndUpdate({
    username
  }, {
    $set: {
      artists: myArtists
    }
  }, (err, user) => {
    if (err) {
      return next(err);
    } else {
      if (action === "following") {
        res.end('{"success" : "Updated Successfully", "status" : 200, "action": "following"}');
      } else {
        res.end('{"success" : "Updated Successfully", "status" : 200, "action": "unfollowing"}');
      }
    }
  });
});


module.exports = router;