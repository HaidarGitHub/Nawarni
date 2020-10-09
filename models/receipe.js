const mongoose = require("mongoose");



const receipeSchema = new mongoose.Schema({
	name: String,
	image: String,
	user: String,
	date: {
		type: Date,
		default: Date.now()
	}
});

module.exports = mongoose.model("Receipe",receipeSchema);