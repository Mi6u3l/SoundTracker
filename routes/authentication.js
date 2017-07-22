/* jshint esversion:6 */
const express = require("express");
const authRoutes = express.Router();
const passport = require("passport");


// User model
const User = require("../models/user");
const Artist = require("../models/artist");
const Song = require("../models/song");
const Playlist = require("../models/playlist");


// Bcrypt to encrypt passwords
const bcrypt = require("bcrypt");
const bcryptSalt = 10;

authRoutes.get("/signup", (req, res, next) => {
  res.render("authentication/signup");
});

authRoutes.post("/signup", (req, res, next) => {
  const username = req.body.username;
  const password = req.body.password;

  if (username === "" || password === "") {
    res.render("authentication/signup", {
      message: "Indicate username and password"
    });
    return;
  }

  User.findOne({
    username
  }, "username", (err, user) => {
    if (user !== null) {
      res.render("authentication/signup", {
        message: "The username already exists"
      });
      return;
    }

    const salt = bcrypt.genSaltSync(bcryptSalt);
    const hashPass = bcrypt.hashSync(password, salt);

    const newUser = User({
      username: username,
      password: hashPass,
      history: [],
      favourites: [],
      artists: [],
      playLists: []
    });

    newUser.save((err) => {
      if (err) {
        res.render("authentication/signup", {
          message: "Something went wrong"
        });
      } else {
        passport.authenticate('local')(req, res, function () {
          res.redirect('/');
        });
      }
    });
  });
});


authRoutes.get("/login", (req, res, next) => {
  res.render("authentication/login", {
    "message": req.flash("error")
  });
});

authRoutes.post("/login", passport.authenticate("local", {
  successRedirect: "/",
  failureRedirect: "/login",
  failureFlash: true,
  passReqToCallback: true
}));


authRoutes.get("/logout", (req, res, next) => {
  let username = req.user.username;
  req.session.destroy((err) => {
    User.findOneAndUpdate({
      username
    }, {
      $set: {
        queue: []
      }
    }, (err, user) => {
      if (err) {
        return next(err);
      } else {
        console.log("updated");
      }
    });
    res.redirect("/login");
  });
});



module.exports = authRoutes;