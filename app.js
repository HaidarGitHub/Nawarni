const express = require("express");
const app = express();
const dotenv = require('dotenv').config();

const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const bcrypt = require ("bcrypt");
const randToken= require("rand-token");
const nodemailer= require("nodemailer");

const session = require("express-session");
const passport= require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

// MODELS
const User=require("./models/user.js");
const Reset=require("./models/reset.js");

const Receipe=require("./models/receipe.js");
const Ingredient=require("./models/ingredient.js");
const Favourite=require("./models/favourite.js");
const Schedule=require("./models/schedule.js");

//SESSION
app.use(session({
	secret:"mysecret",
	resave: false,
	saveUninitialized: false
}));

//PASSPORT
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

mongoose.connect("mongodb+srv://Haidar:R104la108@cluster0.1hhnu.mongodb.net/NAWARNI?retryWrites=true&w=majority", {
	useNewUrlParser: true,
	useUnifiedTopology: true
});
mongoose.set('useCreateIndex', true);

//PASSPORT LOCAL MONGOOSE
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


// EJS
app.set("view engine","ejs");

//PUBLIC FOLDER
app.use(express.static("public"));

//BODY PARSER
app.use(bodyParser.urlencoded({
extended: false
}));



const MethodOverride = require("method-override");
const flash = require("connect-flash");
app.use(flash());
app.use(MethodOverride('_method'));

app.use(function(req,res,next){
	res.locals.currentUser= req.user;
	res.locals.error= req.flash("error");
	res.locals.success= req.flash("success");
	next();
});



app.get("/",function(req,res){
	res.render("index");
});

 app.get("/signup",function(req,res){
	 res.render("signup");
 });

app.post("/signup",function(req,res){
	
	const newUser=new User({
		username:req.body.username,
		surname: req.body.surname,
		email: req.body.email
		
	});
	User.register(newUser,req.body.password,function(err,user){
		if (err){
			console.log(err);
			res.render("signup");
		}else{
			
			passport.authenticate('local')(req,res,function(){
				res.render("signup");
			});
		}
	});
});

app.get("/login",function(req, res){
	res.render("login");
});
app.post("/login",function(req,res){
	
	const user = new User({
		username: req.body.username,
		password: req.body.password
	});
	
	req.login(user,function(err){
		if (err){
			console.log(err);
		}else{
			passport.authenticate("local")(req,res,function(){
				
				res.render("dashboard");
			});
		}
	})
		
});

app.get("/dashboard",isLoggedIn,function(req,res){
	console.log(req.user);
	res.render("dashboard");
});

app.get("/logout",function(req,res){
	req.logout();
	req.flash("success","Vous êtes deconnecté");
	res.redirect("/login");
});
 app.get("/forgot", function(req,res){
	 res.render("forgot");
 });

app.post("/forgot",function(req,res){
	User.findOne({username: req.body.username},function(err,userFound){
		if (err){
			console.log(err);
			res.redirect("/login");
		}else{
			const token= randToken.generate(16);
			Reset.create({
				username: userFound.username,
				resetPasswordToken: token,
				resetPasswordExpires: Date.now()  + 3600000
			});
			
			const transporter = nodemailer.createTransport({
				service: 'gmail',
				auth:{
					user: 'nawarni.elearning@gmail.com',
					pass: process.env.PWD
				}
			});
			const mailOptions={
				from:'nawarni.elearning@gmail.com',
				to: req.body.username,
				subject: 'Lien pour Reset votre mot de passe',
				text: 'Cliquer ici pour rénitialiser votre mot de passe :http://localhost:3000/reset/'+token
			}
			console.log("le mail est pret a etre envoye");
			transporter.sendMail(mailOptions,function(err,response){
				if (err){
					console.log(err);
				}else{
					req.flash("success","Vous receverez un email");
					res.redirect("/login");
				}
			});
		}
	});
});

app.get("/reset/:token",function(req,res){
	Reset.findOne({
		resetPasswordToken: req.params.token,
		resetPasswordExpires: {$gt: Date.now()}
	},function(err,obj){
		if (err){
			console.log("token expired");
			req.flash("error","Lien expiré");
			res.redirect('/login');
		}else{
			res.render('reset',{token:req.params.token});
		}
	});
});

app.post("/reset/:token",function(req,res){
	
	Reset.findOne({
		resetPasswordToken: req.params.token,
		resetPasswordExpires: {$gt: Date.now()}
	},function(err,obj){
		if (err){
			console.log("token expired");
			req.flash("error","Lien expiré");
			res.redirect('/login')
		}else{
			if (req.body.password==req.body.password2){
				User.findOne({username: obj.username},function(err,user){
					if (err){
						console.log(err);
						req.flash("error","Utilisateur non trouvé avec cet email");
					}else{
						user.setPassword(req.body.password,function(err){
							if (err){
								console.log(err);
							}else{
								user.save();
								const updatedReset={
									resetPasswordToken :null,
									resetPasswordExpires: null
								}
								Reset.findOneAndUpdate({resetPasswordToken: 
								  req.params.token},updatedReset,function(err,obj1){
									if (err){
										console.log(err);
									}else{
										res.redirect("/login");
									}
								});
							}
						});
					}
				});
			}
		}
});
});
// Receipe Route

app.get("/dashboard/myreceipes",isLoggedIn,function(req,res){
	Receipe.find({
		user: req.user.id
	}, function(err,receipe){
		if (err){
			console.log(err);
		}else{
			res.render("receipe",{receipe: receipe});
		}
	});
});

app.get("/dashboard/newreceipe",isLoggedIn,function(req,res){
	res.render("newreceipe");
});

app.post("/dashboard/newreceipe",function(req,res){
	const newReceipe = {
		name : req.body.receipe,
		image: req.body.logo,
		user : req.user.id
	}
	Receipe.create(newReceipe, function(err,newReceipe){
		if(err){
			console.log(err);
		
		}else{
			req.flash("success","Nouveau cour bien ajouté!");
			res.redirect("/dashboard/myreceipes");
		}
	});
});




app.get("/dashboard/myreceipes/:id",function(req,res){
	Receipe.findOne({user:req.user.id,_id:req.params.id},function(err,receipeFound){
		if(err){
			console.log(err);
		}else{
			Ingredient.find({
				user: req.user.id,
				receipe: req.params.id
			},function(err,ingredientFound){
			if(err){
				console.log(err);
			}else{
				res.render("ingredients",{
					ingredient: ingredientFound,
					receipe: receipeFound
				});
			}
		})
		}
	})
});


app.delete("/dashboard/myreceipes/:id",isLoggedIn,function(req,res){
	Receipe.deleteOne({_id:req.params.id},function(err){
		if(err){
			console.log(err);
		}else{
			req.flash("success","Le cour a été supprimé");
			res.redirect("/dashboard/myreceipes");
		}
	});
});


//INGREDIENT ROute

app.get("/dashboard/myreceipes/:id/newingredient",function(req,res){
	Receipe.findById({_id:req.params.id},function(err,found){
		if (err){
			console.log(err);
		}else{
			res.render("newingredient",{receipe: found});
		}
	})
});

app.post("/dashboard/myreceipes/:id",function(req,res){
	const newIngredient ={
		name: req.body.name,
		bestDish: req.body.dish,
		user : req.user.id,
		quantity: req.body.quantity,
		receipe: req.params.id
	}
	
	Ingredient.create(newIngredient,function(err,newIngredient){
		if (err){
			console.log(err);
		}else{
			req.flash("success","Votre cours était ajouté");
			res.redirect("/dashboard/myreceipes/"+req.params.id);
		}
	})
});

app.delete("/dashboard/myreceipes/:id/:ingredientid",isLoggedIn,function(req,res){
	Ingredient.deleteOne({_id: req.params.ingredientid},function(err){
		if (err){
			console.log(err);
		} else{
			req.flash("success","Votre Cours a été suprimé");
			res.redirect("/dashboard/myreceipes/"+req.params.id);
		}
	})
});

app.post("/dashboard/myreceipes/:id/:ingredientid/edit",isLoggedIn,function(req,res){
	Receipe.findOne({user:req.user.id,_id:req.params.id},function(err,receipeFound){
		if (err){
			console.log(err);
			
		}else{
			Ingredient.findOne({
				_id:req.params.ingredientid,
				receipe: req.params.id
			},function(err,ingredientFound){
				if (err){
					console.log(err);
				}else{
					res.render("edit",{
						ingredient: ingredientFound,
						receipe: receipeFound
					});
				}
			});
		}
	});
});

app.put("/dashboard/myreceipes/:id/:ingredientid",isLoggedIn,function(req,res){
	const ingredient_updated={
		name: req.body.name,
		bestDish: req.body.dish,
		user: req.user.id,
		quantity: req.body.quantity,
		receipe: req.params.id
	}
	
	Ingredient.findByIdAndUpdate({_id:
		req.params.ingredientid},ingredient_updated,function(err,updatedIngredient){
		if(err){
			console.log(err);
		}else{
			req.flash("success","Votre Cours a était bien modifié!");
			res.redirect("/dashboard/myreceipes/"+req.params.id);
		}
	});
});
//FAVOURITE ROUTES

app.get("/dashboard/favourites",isLoggedIn,function(req,res){
	Favourite.find({user:req.user.id},function(err,favourite){
	if(err){
		console.log(err);
	}else{
		res.render("favourites",{favourite: favourite});
	}
})
});

app.get("/dashbsoard/favourites/newfavourite",isLoggedIn,function(req,res){
	res.render("newfavourite");
});

app.post("/dashboard/favourites",isLoggedIn,function(req,res){
	const newFavourite={
		image: req.body.image,
		title: req.body.title,
		description: req.body.description,
		user:req.user.id
	}
	Favourite.create(newFavourite,function(err,newFavourite){
		if(err){
			console.log(err);
		}else{
			
		req.flash("success","Vous avez ajouté un cour favouris!");
		res.redirect("/dashboard/favourites");
		}
	})
});

app.delete("/dashboard/favourites/:id",isLoggedIn,function(req,res){
	Favourite.deleteOne({_id: req.params.id},function(err){
		if (err){
			console.log(err);
		}else{
			req.flash("success","Votre favouris a été supprimé");
			res.redirect("/dashboard/favourites");
		}
	});
});


app.get("/dashboard/schedule",isLoggedIn,function(req,res){
	Schedule.find({user:req.user.id},function(err,schedule){
		if(err){
			console.log(err);
		}else{
			res.render("schedule",{schedule: schedule});
		}
	});
});
app.get("/dashboard/schedule/newschedule",isLoggedIn,function(req,res){
	res.render("newSchedule");
});
app.post("/dashboard/schedule",isLoggedIn,function(req,res){
	const newSchedule={
		ReceipeName: req.body.receipename,
		scheduleDate: req.body.Date,
		user: req.body.id,
		time: req.body.time
	}
	Schedule.create(newSchedule,function(err,newSchedule){
		if (err){
			console.log(err);
		}else{
			req.flash("success","Vous avez ajouté un nouveau planning");
			res.redirect("/dashboard/schedule");
		}
	});
});


app.delete("/dashboard/schedule/:id",isLoggedIn,function(req,res){
	Schedule.deleteOne({_id:req.params.id},function(err){
		if(err){
			console.log(err);
		}else{
			req.flash("success","Vous avez bien supprimé votre cour programmé");
			res.redirect("/dashboard/schedule");
		}
	});
});

//Fonction de connexion

function isLoggedIn(req,res,next){
if (req.isAuthenticated()){
	return next();
}else{
	req.flash("error","Merci d'enrigistrer tout d'abord!");
	res.redirect("/login");
}
}


app.listen(3000, function(req,res){
	console.log("tout marche bien");
})