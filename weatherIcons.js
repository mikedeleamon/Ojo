//weatherImages.js
//stores weather icons for rendering


export const weatherIcons = {
	Sunny: require('Ojo/app/assets/images/Sunny.png'),
	ClearNight: require('Ojo/app/assets/images/ClearNight.png'),
	Mist: require('Ojo/app/assets/images/Cloudy.png'),
	Cloudy: require('Ojo/app/assets/images/Cloudy.png'),
	PartlyCloudy: require('Ojo/app/assets/images/PartlyCloudy.png'),
	PartlyCloudyNight: require('Ojo/app/assets/images/PartlyCloudyNight.png'),
	Rainy: require('Ojo/app/assets/images/Rainy.png'),
	Snow: require('Ojo/app/assets/images/Snow.png'),
	Storm: require('Ojo/app/assets/images/Storm.png')
}

export const weatherGradients = {
	Sunny: ['#2989D8','#60A1D6','#7EAED6'],
	ClearNight: ["#182848","#141E30"],//"#4b6cb7","#525252",
	Mist: ["#fff", "#abc", "#1fe"],
	Cloudy: ["#e0e0eb","#c6d9ec","#b3cce6"],
	PartlyCloudy: ['#2989D8','#60A1D6','#7EAED6'],
	PartlyCloudyNight: ["#4b6cb7","#182848","#141E30"],
	Rainy: ["#525252","#141E30","#182848"],//["#525252","#141E30","#182848"]"#4b6cb7","#182848",
	RainyNight: ["#525252","#141E30","#182848"],
	Snow: ["#fff", "#abc", "#1fe"],
	Storm: ["#141E30","#182848","#4b6cb7"]
}

//export default {weatherIcons, weatherGradients}