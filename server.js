var express  = require('express')
var app =  express();
var bodyParser = require('body-parser')
var ObjectId = require('mongodb').ObjectId

var http = require('http').createServer(app);
var io = require("socket.io")(http);


var formidable = require("formidable")
var fs = require('fs')
var session = require('express-session')
app.use(session({
    key:"admin",
    secret:"any random string"
}));

var nodemailer = require('nodemailer')


app.use('/static', express.static(__dirname + '/static'));
app.set('view engine','ejs')

app.use(bodyParser.urlencoded())
app.use(bodyParser.json())

var MongoClient = require('mongodb').MongoClient;
MongoClient.connect('mongodb://localhost:27017/blog',{useNewUrlParser:true,useUnifiedTopology: true },
    function(error,clinet){
        var blog = clinet.db('blog')
        console.log('db connected')

        // =====================================================

        app.get("/do-logout", function (req,res,next) {
            req.session.destroy();
            res.redirect('/admin')
        })

        // ==============================
        app.get('/admin/settings', function (req,res,next){

            blog.collection("settings").findOne({} , function (error, settings) {

                res.render('admin/settings', {
                    "post_limit": settings.post_limit,
                })

            })
            
        })

        app.post('/admin/save_settings' , function (req,res,next) {
            blog.collection('settings').update({} , {
                "post_limit": req.body.post_limit
            }, {upsert:true} , function (error, document) {
                res.redirect('/admin/settings')
            })
        })
        // =====================================================
        //phan trang
        app.get('/get-posts/:start/:limit', function (req,res,next) {

            blog.collection("posts").find().sort({
                    "_id":-1
            }).skip(parseInt(req.params.start)).limit(parseInt(req.params.limit)).toArray(
                function (error,posts) {
                    res.send(posts)
                }
            )


        })
       
        

        // ==============================
        app.get('/',function (req,res,next){

            blog.collection('settings').findOne({}, function (error, settings) {

                var postLimit = parseInt(settings.post_limit) ;
                
                blog.collection("posts").find()
                .sort({"_id": -1})// dang bai moi nhat len tren cung
                .limit(postLimit)
                .toArray(function(error,posts){
                    //posts = posts.reverse(); // dang bai moi nhat len tren cung

                    res.render('user/home',
                    {posts: posts,
                    "postLimit" : postLimit
                    })

                })
            })
        })

        // =====================================================
        // phan quyen admin
        app.get('/admin/dashboard',function (req,res,next){
            if(req.session.admin){
            res.render('admin/dashboard')
            } else {
                res.redirect('/admin')
            }
        })

        // =====================================================
        // POST bai
        app.get('/admin/posts',function (req,res,next){
            if(req.session.admin){

                blog.collection('posts').find().toArray(function (error, posts) {
                    res.render('admin/posts', {'posts': posts})
                })

             
                } else {
                    res.redirect('/admin')
                }
        })

        // ==============================
        // Sua ejs
        app.get('/posts/edit/:id' , function (req, res, next) {
            if (req.session.admin) {
            
            blog.collection('posts').findOne({
                "_id": ObjectId(req.params.id)
            }, function (error, post) {
                res.render('admin/edit_post', {'post': post})
            })
            
            }else {

            }
        })

        //  sua api

        app.post('/do-edit-post' ,function(req,res,next) {
            // console.log(req.body)
            blog.collection('posts').updateOne({
                "_id": ObjectId(req.body._id)
            }, {
                $set : {
                    'title': req.body.title,
                    'content': req.body.content,
                    "image": req.body.image
                }
            }, function(error, post) {
                res.send('update-success')
            })
        })



        // =====================================================
        // đăng nhập
        app.post("/do-admin-login", function (req,res,next) {
            blog.collection('admins').findOne({
                "email": req.body.email,
                 "password": req.body.password }, function (error, admin){
                    if (admin != "") {
                        req.session.admin = admin;
                    }
                    res.send(admin)
                 })
        })


        app.get('/admin',function (req,res,next){
            res.render('admin/login')
        })

        // =====================================================

        app.post('/do-post', function(req,res,next){
            blog.collection('posts').insertOne(req.body , function(error,document){
                res.send({
                    text: 'đăng thành công',
                    _id: document.insertedId
                })
            })
        })

        // =====================================================
        // post chi tiet
        app.get('/posts/:id',function(req,res,next){
            // res.send(req.params.id) kiểm tra id trước
            blog.collection('posts').findOne({'_id': ObjectId(req.params.id)} , function(error,post){
                res.render('user/post',{post:post})
            })
        })

        // =====================================================
        //reply
        app.post('/do-reply', function (req,res,next){
            var reply_id = ObjectId();

            blog.collection('posts').updateOne({
                "_id":ObjectId(req.body.post_id),
                "comments._id" : ObjectId(req.body.comment_id)
            }, {
                $push:{
                    "comments.$.replies":{
                        _id: reply_id,
                        name: req.body.name,
                        reply: req.body.reply

                    }
                }
            }, function (error,document) {
                var transporter = nodemailer.createTransport({
                    "service": "gmail",
                    "auth" : {
                        "user":"nqt130298@gmail.com",
                        "pass":"Ninhbinh123"
                    }
                })

                var mailOptions = {
                    "form" :"My Blog",
                    "to" : req.body.comment_email,
                    "subject" : "New reply",
                    "text" :req.body.name + "has replied on you comment http://localhost:5000/posts/" + req.body.post_id
                }

                transporter.sendMail(mailOptions, function (error,info) {
                    res.send ({
                        text:"Replied",
                        _id: reply_id
                    })
                })
            })
        })
        
        // =================================================
        //comment 
        app.post('/do-comment', function(req,res,next){
            var comment_id =  ObjectId();

            blog.collection('posts').updateOne({"_id": ObjectId(req.body.post_id)},{
                $push:{
                    "comments":{_id: comment_id ,username: req.body.username,
                                comment: req.body.comment,
                                email: req.body.email}
                }
            },function (error,post) {
                res.send({
                    text:'comment thành công',
                    _id: post.insertedId
                })
            });
        })


        // =====================================================       
        // update image
        app.post('/do-upload-image',function (req,res,next) {
            var formData = new formidable.IncomingForm({ uploadDir: __dirname + '/static/images',keepExtensions :true });
            formData.parse(req, function (error, fields , files) {
                var oldPath = files.file.path;
                var newPath = `/static/images/${files.file.path.split("static\\images\\")[1]}`;
                res.send(newPath);
            })
        })

        app.post('/do-update-image', function (req, res,next) {
            var formData = new formidable.IncomingForm({ uploadDir: __dirname + '/static/images',keepExtensions :true });
            formData.parse(req, function (error, fields , files) {

                fs.unlink(fields.image.replace('/','') , function (error) {
                    var oldPath = files.file.path;
                    var newPath = `/static/images/${files.file.path.split("static\\images\\")[1]}`;
                    res.send(newPath);
                })
            })
        })
        
        // ==============================
        // delete

        app.post('/do-delete', function (req, res,next) {
            if (req.session.admin) {

            fs.unlink(req.body.image.replace('/',''), function (error) {

                blog.collection('posts').deleteOne({
                    "_id": ObjectId(req.body._id)
                }, function (error,document) {
                    res.send('delete')
                })

            })

            }else {
                    res.redirect('/admin')
            }
        })

        // ===================================================== 
        //socket io
        io.on('connection',function (socket){
            console.log("user connected")
            socket.on("new_post", function (formData){
                // console.log(formData)
                socket.broadcast.emit("new_post", formData)
            });
            socket.on('new_comment', function (comment) {
                io.emit('new_comment',comment)
            })
            socket.on("new_reply", function (reply) {
                io.emit('new_reply',reply)
            })


            socket.on("delete_post", function (replyId) {
                // console.log(replyId)
                socket.broadcast.emit('delete_post', replyId) 
            })
        })
 // broadcast sẽ gửi tin nhắn đến tất cả các khách hàng khác ngoại trừ kết nối mới được tạo
        // =====================================================         
        http.listen(5000, function(){
            console.log('conect')
        })
    })

