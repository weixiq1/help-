const fs = require('fs');
const express = require('express');
const router = express.Router();
// const authMiddleware = require ('../middlewares/authMiddleware');
const UserDetails = require('../models/UserDetails');
const User = require('../models/user');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/img/avatars');
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const filename = file.fieldname + '-' + Date.now() + ext;
        cb(null, filename);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true)
        } else {
            cb('Error: Images only!');      
        }
    }
}).single('avatar');

function checkAuth (req, res, next) {
    if(!req.session.user || (req.session.user.role !== 'admin' && req.session.user.role !== 'user')) {
        return res.redirect('/login')
    }
    next();
}

router.get('/', (req, res) => {
    res.render('dashboard', { session: req.session });
});

router.get('/user-data', async (req, res) => {
    let userDetails = await UserDetails.findOne({ user: req.session.user._id });
    if(!userDetails) {
        userDetails = new UserDetails({
            user: req.session.user._id,
            nickname: '',
            about: '',
            avatarUrl: ''
        });
        await userDetails.save();
    }
    res.render('userDataForm', { session: req.session, userDetails: userDetails });
}); 

router.get('/profile/:id', checkAuth, async (req, res) => {
    const userDetails = await UserDetails.findOne({ user: req.params.id }).populate('user');
    if( !userDetails ) {
        return res.redirect('/dashboard');
    }
    console.log(userDetails)
    res.render('userProfile', { session: req.session, userDetails: userDetails });
});

router.post('/user-data', async (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            return res.render('userDataForm', { session: req.session, error: err});
        }
    
    let userDetails;
    userDetails = await UserDetails.findOne({ user: req.session.user._id });

    if (userDetails) {
        userDetails.nickname = req.body.nickname;
        userDetails.about = req.body.about;


        if(req.file) {
            const oldAvatarPath = userDetails.avatarUrl ? path.join(__dirname, '..', 'public', userDetails.avatarUrl) : null

            userDetails.avatarUrl = '/img/avatars/' + req.file.filename;

            if (oldAvatarPath && fs.existsSync(oldAvatarPath)) {
                fs.unlinkSync(oldAvatarPath);
            }
        }
        await userDetails.save();
    } else {
        userDetails = new UserDetails({
            user: req.body.user,
            nickname: req.body.nickname,
            about: req.body.about,
            avatarUrl: req.file ? '/img/avatars/' + req.file.filename : null,
            user: req.session.user._id,
        });
        await userDetails.save();
    }
    
    res.redirect('/dashboard');
    });
});

router.post('/profile/:id/delete-avatar', async (req, res) => {
    const userDetails = await UserDetails.findOne({ user: req.params.id });
    
    if (!userDetails) {
        return res.redirect('/dashboard');
    }

    if( userDetails.avatarUrl) {
        const filePath = path.join(__dirname, '..', 'public', userDetails.avatarUrl);
        fs.unlinkSync(filePath);
    }

    userDetails.avatarUrl = null;
    await userDetails.save();

    res.redirect(`/dashboard/profile/${req.params.id}`);
})

module.exports = router;