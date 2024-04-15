const express = require('express');
const ejs = require('ejs');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session')
const mongodbSession = require('connect-mongodb-session')(session)

const app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));

const isAuth = (req,res,next)=>{
    if(req.session.isLoggedin == true){
        next()
    }else{
        res.redirect('/login')
    }
}

const isAdmin = (req,res,next)=>{
    if(req.session.isLoggedin == true && req.session.user.role == 2){
        next()
    }else{
        res.redirect('/')
    }
}


//DB CONNECT
mongoose.connect('mongodb+srv://sai4502:sai4502@cluster0.qmhmt5z.mongodb.net/').then(()=>{
    console.log('Connected');
})

//SCHEMAS
const userSchema = new mongoose.Schema({
    username: {type: String},
    password: {type: String},
    role: {type: Number},
    name: {type: String},
    phone: {type: String},
    branch: {type: String},
    resume: {type: String},
    percentage: {type: String},
    cgpa: {type: String},
})
const Users = mongoose.model('users', userSchema);

const jobSchema = new mongoose.Schema({
    company: {type: String},
    location: {type: String},
    job_description: {type: String},
    description: {type:String},
    link: {type: String},
    role: {type: String},
    job_salary: {type: String},
    job_status: {type: Boolean},
    job_deadline: {type: String},
    company_image: {type: String},
    eligibility: {type: String},
})
const Jobs = mongoose.model('Job',jobSchema);

const applySchema = new mongoose.Schema({
    jobid : {type: String},
    name: {type: String},
    rollno: {type: String},
    branch: {type: String},
    resume: {type: String},
})
const Apply = mongoose.model('Apply',applySchema);

const materialSchema = new mongoose.Schema({
    title : {type: String},
    cat: {type: String},
    img: {type: String},
    url: {type: String},
})
const Material = mongoose.model('Material',materialSchema);

//Sessions
const store = new mongodbSession({
    uri: "mongodb+srv://sai4502:sai4502@cluster0.qmhmt5z.mongodb.net/",
    collection: 'session'
})
app.use(session({
    secret: "this is secret key",
    resave: false,
    saveUninitialized: false,
    store: store
}))


const cron = require('node-cron');
const moment = require('moment'); // For date manipulation, if needed

cron.schedule('0 0 * * *', async () => {
    // Convert today's date to a string in the format YYYY-MM-DD
    const todayStr = new Date().toISOString().split('T')[0];

    // Update job_date to today's date (as a string) for all documents
    await Jobs.updateMany({}, { $set: { job_date: todayStr } });

    // Then, update job_status based on the comparison with job_deadline (also a string)
    await Jobs.updateMany(
        { job_deadline: { $lt: todayStr } }, // If job_deadline is before today
        { $set: { job_status: 'inactive' } }
    );
    await Jobs.updateMany(
        { job_deadline: { $gte: todayStr } }, // If job_deadline is today or in the future
        { $set: { job_status: 'active' } }
    );

    console.log('job_date updated to the current date and job statuses refreshed.');
});




//ROUTES
app.get('/',isAuth,async (req, res) => {
    let jobs = await Jobs.find();
    let materials = await Material.find();
    res.render('index',{user:req.session.user,jobs:jobs,materials:materials});
});

app.post('/login',async(req, res) =>{
    console.log(req.body.username,req.body.password);
    let user = await Users.findOne({username:req.body.username});
    if(user){
        if(user.password === req.body.password && user.role === 2){
            req.session.isLoggedin = true;
            req.session.user = user;
            console.log(req.session.user);
            res.redirect('/placements-dashboard');
        }
        else if(user.password === req.body.password && user.role === 0){
            req.session.isLoggedin = true;
            req.session.user = user;
            console.log(req.session.user);
            res.redirect('/');
        }
        else{
            res.redirect('/login');
        }
    }else{
        res.redirect('/login');
    }
})

app.get('/placements-dashboard',isAdmin,(req, res) => {
    res.render('placements-dashboard');
})

app.get('/posting',isAdmin,async(req, res) => {
    let jobs = await Jobs.find()
    res.render('posting',{jobs:jobs});
})

app.get('/preview/:id',isAdmin,async(req, res) => {
    let job = await Jobs.findById(req.params.id);
    res.render('preview',{job:job});
});

app.post('/add-job',isAdmin,async(req, res) => {
    let status = (new Date(req.body.lastdate) > Date.now()) ? true : false;
    let newJob = new Jobs({
        company: req.body.company,
        location: req.body.location,
        job_description: req.body.about,
        role: req.body.role,
        job_salary: req.body.package,
        job_status: status,
        job_deadline: req.body.lastdate,
        company_image: req.body.companylogo,
        eligibility: req.body.eligibility,
        description: req.body.desc,
        link: req.body.link,
    })
    await newJob.save();
    res.redirect('/posting');
});

app.get('/delete-job/:id',isAdmin,async(req, res) => {
    await Jobs.findByIdAndDelete(req.params.id);
    await Apply.find({jobId: req.params.id})
    res.redirect('/posting');
})

app.post('/update-job/:id',isAdmin, async (req, res) => {
    try {
        let status = new Date(req.body.lastdate) > Date.now();

        const updateFields = {};
        if (req.body.company) updateFields.company = req.body.company;
        if (req.body.location) updateFields.location = req.body.location;
        if (req.body.about) updateFields.job_description = req.body.about;
        if (req.body.role) updateFields.role = req.body.role;
        if (req.body.package) updateFields.job_salary = req.body.package;
        if (status !== undefined) updateFields.job_status = status;
        if (req.body.lastdate) updateFields.job_deadline = req.body.lastdate;
        if (req.body.companylogo) updateFields.company_image = req.body.companylogo;
        if (req.body.eligibility) updateFields.eligibility = req.body.eligibility;

        const updatedJob = await Jobs.findByIdAndUpdate(req.params.id, updateFields, { new: true });

        if (!updatedJob) {
            return res.status(404).send("Job not found");
        }

        console.log("Job updated:", updatedJob);
        res.redirect('/posting');
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

app.post('/update-user/:id',isAuth, async (req, res) => {
    console.log("called");
    try {

        const updateFields = {};
        if (req.body.name) updateFields.name = req.body.name;
        if (req.body.username) updateFields.username = req.body.username;
        if (req.body.phone) updateFields.phone = req.body.phone;
        if (req.body.branch) updateFields.branch = req.body.branch;
        if (req.body.percentage) updateFields.percentage = req.body.percentage;
        if (req.body.cgpa) updateFields.cgpa = req.body.cgpa;
        if (req.body.resume) updateFields.resume = req.body.resume;
        console.log(updateFields);
        const updatedJob = await Users.findByIdAndUpdate(req.params.id, updateFields, { new: true });
        req.session.user = updatedJob
        if (!updatedJob) {
            return res.status(404).send("User not found");
        }
        console.log("User updated:", updatedJob);
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

app.get('/login',(req, res)=>{
    res.render('login');
})

app.get('/register', (req, res)=>{
    res.render('register');
})

app.post('/register', async(req, res)=>{
    let newUser = new Users({
        username: req.body.username,
        password: req.body.password,
        role: req.body.role,
        name: req.body.name,
        phone: req.body.phone,
        branch: req.body.branch,
        resume: req.body.resume,
        role: 0
    });
    await newUser.save();
    res.redirect('/login');
})

app.get('/logout',(req,res)=>{
    req.session.destroy();
    res.redirect('/login');
})

app.get('/view-all',isAuth,async (req, res) => {
    let jobs = await Jobs.find();
    res.render('alljobs',{jobs:jobs});
})

app.get('/view/:id',isAuth,async(req, res) => {
    let job = await Jobs.findById(req.params.id);
    let applied = await Apply.find({jobid:req.params.id,rollno:req.session.user.username})
    res.render('view',{job:job,user:req.session.user,applied:applied.length});
});
app.post('/apply/:id',isAuth,async(req, res) => {
    let id = req.params.id;
    console.log(id);
    let apply = new Apply({
        jobid: id,
        name: req.session.user.name,
        rollno: req.session.user.username,
        branch: req.session.user.branch,
        resume: req.session.user.resume
    })
    await apply.save()
    res.redirect('/view-all')
});

app.get('/manage',isAdmin,async(req, res)=>{
    let users = await Users.find({role:0});
    res.render('manage-users',{users:users});
})

app.get('/applications',isAdmin,async(req, res)=>{
    let users = await Apply.find();
    let jobs = await Jobs.find();
    res.render('view-applications',{apply:users,jobs:jobs});
})

app.get('/application/:id',isAdmin,async(req, res)=>{
    let users = await Apply.find({jobid:req.params.id});
    let jobs = await Jobs.find();
    res.render('view-applications',{apply:users,jobs:jobs});
})

app.get('/delete-user/:id',isAdmin,async(req, res)=>{
    await Users.findByIdAndDelete(req.params.id);
    res.redirect('/manage');
})

app.get('/delete-material/:id',isAdmin,async(req, res)=>{
    await Material.findByIdAndDelete(req.params.id);
    res.redirect('/materials');
})

app.get('/materials',isAdmin,async(req, res)=>{
    let materials = await Material.find();
    res.render('materials',{materials: materials});
})

app.post('/add-pdf',isAdmin,async(req, res)=>{
    let newMaterial = new Material({
        title: req.body.title,
        cat: req.body.cat,
        url: req.body.url,
        img: req.body.img
    })
    await newMaterial.save();
    res.redirect('/materials');
})

app.get('/*',(req, res) => {
    res.json("Page Not Found")
})

//PORT
app.listen(8000, () => {
    console.log('Server is running on port http://localhost:8000');
});