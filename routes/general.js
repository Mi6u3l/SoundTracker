const express = require('express');
const router = express.Router();
const ensureLogin = require("connect-ensure-login");
const request = require('request');
const User = require("../models/user");



function checkDuplicateLists(database,add){
  for(var i = 0;i<database.length;i++){
    if(database[i].name === add.name){
      return false;
    }
  }
  return true;
}

//Render main page - history
router.get("/", ensureLogin.ensureLoggedIn(), (req,res,next) => {
     req.session.myQueue = [];
     let username = req.user.username;
     let history = [];
     User.findOne({username}, (err,user) => {
     if(err){
       return next(err);
     } else{
       history = user.history;
       res.render("history", {username: req.user.username, history });
     }
   });
});


//Render search results
router.get("/searchresults", ensureLogin.ensureLoggedIn(), (req,res,next) => {
  res.render("searchresults" , {username: req.user.username });
});

//Render play single music
router.post("/playsingle", ensureLogin.ensureLoggedIn(), (req,res,next) => {
  let song = {
    previewUrl: req.body.preview,
    name: req.body.songName,
    id: req.body.songId,
    image: req.body.songImage
  };

  let artistName = req.body.artist;
  let artistId = req.body.artistId;
  let artistInfo = {};
  request('http://api.openaura.com/v1/search/artists_all?q='+ artistName + '&api_key=' + process.env.OPENAURA_KEY, ((error, response, body) => {
    if (!error && response.statusCode == 200) {
        let result =  JSON.parse(response.body);

        let firstFoundArtist = result[0];
        let openauraArtistId = firstFoundArtist.oa_artist_id;
        request('http://api.openaura.com/v1/info/artists/' + openauraArtistId + '?id_type=oa%3Aartist_id&api_key=' + process.env.OPENAURA_KEY, ((error, response, body) => {
           if (!error && response.statusCode == 200) {
             let result =  JSON.parse(response.body);

              artistInfo.id = artistId;
              artistInfo.name = result.name;
              //artistInfo.bio = result.bio.media[0].data.text;
              let artistBio = result.bio.media[0].data.text;
              artistBio = artistBio.replace(/[^a-zA-Z ]/g, "");
              if (result.fact_card.media[0].data.birthplace !== '') {
                artistInfo.locationLabel = 'Birth Place';
                artistInfo.location = result.fact_card.media[0].data.birthplace;
              } else {
                artistInfo.locationLabel = 'Location Formed';
                artistInfo.location = result.fact_card.media[0].data.location_formed;
              }

              //save to history
              let username = req.user.username;
              const songObject = {
                name: song.name,
                image: song.image,
                id_song: song.id,
                preview_url: song.previewUrl,
                artists: [req.body.songArtists],
                artist_id: artistInfo.id,
                artist_name: artistInfo.name,
                artist_bio: artistBio,
                artist_location: artistInfo.location,
                artist_locationLabel:  artistInfo.locationLabel
              };

              let myHistory = req.user.history;
              if(checkDuplicateLists(myHistory,songObject)){
                myHistory.unshift(songObject);
                User.findOneAndUpdate({username},{$set: {history: myHistory}}, (err,user) => {
                  if(err){
                    return next(err);
                  }
                });
              }

              //render play control
              res.render("playsingle", { song, artistInfo, artistBio, username: req.user.username});
           }
        }));

    } else {
      return next(err)
    }
  }));
});


//Render favorites
router.get("/favorites",  ensureLogin.ensureLoggedIn(),(req,res,next) => {
     let username = req.user.username;
     let favourites = [];
     User.findOne({username}, (err,user) => {
     if(err){
       return next(err);
     }
     else{
       favourites = user.favourites;
       res.render("favorites", {username: req.user.username, favourites });
     }
   });

});

//Render history
router.get("/history",  ensureLogin.ensureLoggedIn(),(req,res,next) => {
     let username = req.user.username;
     let history = [];
     User.findOne({username}, (err,user) => {
     if(err){
       return next(err);
     } else{
       history = user.history;
       res.render("history", {username: req.user.username, history });
     }
   });

});

//Render queue
router.get("/queue",(req,res,next) => {
  let queue = req.session.myQueue;
  res.render("queue", {username: req.user.username, queue });
 });


//Render playlists
router.get("/playlists",  ensureLogin.ensureLoggedIn(),(req,res,next) => {
  res.render("playlists");
});


module.exports = router;
