const Sequelize = require("sequelize");
const {models} = require("../models");

// Autoload the quiz with id equals to :quizId
exports.load = (req, res, next, quizId) => {

    models.quiz.findById(quizId)
    .then(quiz => {
        if (quiz) {
            req.quiz = quiz;
            next();
        } else {
            throw new Error('There is no quiz with id=' + quizId);
        }
    })
    .catch(error => next(error));
};


// GET /quizzes
exports.index = (req, res, next) => {

    models.quiz.findAll()
    .then(quizzes => {
        res.render('quizzes/index.ejs', {quizzes});
    })
    .catch(error => next(error));
};


// GET /quizzes/:quizId
exports.show = (req, res, next) => {

    const {quiz} = req;

    res.render('quizzes/show', {quiz});
};


// GET /quizzes/new
exports.new = (req, res, next) => {

    const quiz = {
        question: "", 
        answer: ""
    };

    res.render('quizzes/new', {quiz});
};

// POST /quizzes/create
exports.create = (req, res, next) => {

    const {question, answer} = req.body;

    const quiz = models.quiz.build({
        question,
        answer
    });

    // Saves only the fields question and answer into the DDBB
    quiz.save({fields: ["question", "answer"]})
    .then(quiz => {
        req.flash('success', 'Quiz created successfully.');
        res.redirect('/quizzes/' + quiz.id);
    })
    .catch(Sequelize.ValidationError, error => {
        req.flash('error', 'There are errors in the form:');
        error.errors.forEach(({message}) => req.flash('error', message));
        res.render('quizzes/new', {quiz});
    })
    .catch(error => {
        req.flash('error', 'Error creating a new Quiz: ' + error.message);
        next(error);
    });
};


// GET /quizzes/:quizId/edit
exports.edit = (req, res, next) => {

    const {quiz} = req;

    res.render('quizzes/edit', {quiz});
};


// PUT /quizzes/:quizId
exports.update = (req, res, next) => {

    const {quiz, body} = req;

    quiz.question = body.question;
    quiz.answer = body.answer;

    quiz.save({fields: ["question", "answer"]})
    .then(quiz => {
        req.flash('success', 'Quiz edited successfully.');
        res.redirect('/quizzes/' + quiz.id);
    })
    .catch(Sequelize.ValidationError, error => {
        req.flash('error', 'There are errors in the form:');
        error.errors.forEach(({message}) => req.flash('error', message));
        res.render('quizzes/edit', {quiz});
    })
    .catch(error => {
        req.flash('error', 'Error editing the Quiz: ' + error.message);
        next(error);
    });
};


// DELETE /quizzes/:quizId
exports.destroy = (req, res, next) => {

    req.quiz.destroy()
    .then(() => {
        req.flash('success', 'Quiz deleted successfully.');
        res.redirect('/quizzes');
    })
    .catch(error => {
        req.flash('error', 'Error deleting the Quiz: ' + error.message);
        next(error);
    });
};


// GET /quizzes/:quizId/play
exports.play = (req, res, next) => {

    const {quiz, query} = req;

    const answer = query.answer || '';

    res.render('quizzes/play', {
        quiz,
        answer
    });
};


// GET /quizzes/:quizId/check
exports.check = (req, res, next) => {

    const {quiz, query} = req;

    const answer = query.answer || "";
    const result = answer.toLowerCase().trim() === quiz.answer.toLowerCase().trim();

    res.render('quizzes/result', {
        quiz,
        result,
        answer
    });
};

// GET /quizzes/randomPlay
exports.randomPlay = (req, res, next) => {
 
    // Se guardan las preguntas respondidas (los ids)
    req.session.randomPlay = req.session.randomPLay || [];
    
    Sequelize.Promise.resolve()
    .then(() => {
        
        // Preguntas que no se han respondido, el id no esta en req.session.randomPLay
        return models.quiz.count({where: {'id': {[Sequelize.Op.notIn]: req.session.randomPLay}}})
         
        //Contamos las preguntas
        .then(count => {
            // la puntuación serán las preguntas respondidas.
            let score = req.session.randomPLay.length();
            if (count === 0) {
                delete req.session.randomPLay;
                //Renderizamos la vista random_nomore
                res.render('quizzes/random_nomore', {score});
            }
            //creamos una variable aleatoria (con el valor de los quizzes no contestados aún)
            let rndm = Math.floor(Math.random() * count);
            //Buscamos esas preguntas
            return models.quiz.findAll({where: {'id': {[Sequelize.Op.notIn]: req.session.randomPLay}}, offset: rndm,limit: 1
            }) 
            .then(quizzes => {
                return quizzes[0]; //Devolvemos la primera pregunta 
            });
        })
        .catch(error => {
            req.flash('error', `Error deleting the quiz: ${error.message}`);
            next(error);
        });
    })
    .then(quiz => {
        console.log(`QUIZ: ${quiz}`);
        let score = req.session.randomPLay.length();
        res.render('quizzes/random_play', {quiz, score});
    });

};

// GET /quizzes/randomCheck
exports.randomCheck = (req, res, next) => {
    //Guardamos las preguntas
req.session.randomPlay = req.session.randomPLay || [];
    const answer = req.query.answer;
    const result = (answer.toLowerCase().trim() === req.quiz.answer.toLowerCase().trim());
    let score = req.session.randomPLay.length();
    console.log(score);
    if (result) { //Si la respuesta coincide con la correcta (Sin mayúsculas ni espacios)
        
        if (req.session.randomPLay.indexOf(req.quiz.id) === -1) {
            req.session.randomPLay.push(req.quiz.id);
            score = req.session.randomPLay.length();
        }
        
        models.quiz.count() //contamos el número de quizzes
        .then(count => {
            if (score > count) { //Si las respondidas son mayores que el número de quizzes
                delete req.session.randomPLay;    //eliminamos las preguntas resultas (vaciamos)
                res.render('quizzes/random_result', {score, answer, result}); //Renderizamos la vista y actualizamos result, score y answer
            } else {
                res.render('quizzes/random_result', {score, answer, result});
            }
        });
    } else { //Si la respuesta no coincide
        let score = req.session.randomPLay.length(); // La puntuación son las preguntas que llevaba resueltas
        delete req.session.randomPLay;    //Vaciamos las preguntas
        res.render('quizzes/random_result', {score, answer, result}); //renderizamos la vista
    }
};








