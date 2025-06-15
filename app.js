const express = require("express");
const session = require("express-session");
const sqlite3 = require("sqlite3");
//const bodyparser = require("body-parser");

const app = express();

const PORT = 8000;

//Conexao com o BD
const db = new sqlite3.Database("users.db");

db.serialize(() => {
    db.run(
        "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, password TEXT)"
    )
    db.run(
        "CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT, id_users INTEGER, titulo TEXT, conteudo TEXT, data_criacao TEXT)"
    )

})

app.use(
    session({
        secret: "senhaforteparacriptografarasessao",
        resave: true,
        saveUninitialized: true,
    })
)

app.use('/static', express.static(__dirname + '/static'));

//Configuração Expressa para processar requisições POST com Body Parameters
//app.use(bodyparser.urlencoded({extended: true})); //versão express 4
app.use(express.urlencoded({ extended: true })); //versão express 5

app.set('view engine', 'ejs');

app.get("/", (req, res) => {
    console.log("GET /")
    //res.send("Alô SESI Sumaré");
    //res.send("<img src='./static/download.png'/>")
    res.render("./pages/index", { titulo: "Index", req: req });
});

app.get("/sobre", (req, res) => {
    console.log("GET /sobre")
    res.render("./pages/sobre", { titulo: "Sobre", req: req });
});

app.get("/cadastro", (req, res) => {
    console.log("GET /cadastro")
    res.render("./pages/cadastro", { titulo: "Cadastro", req: req });
});

app.post("/cadastro", (req, res) => {
    console.log("POST /cadastro");
    console.log(JSON.stringify(req.body));
    const { username, password } = req.body;

    if (!username || !password || username.trim() === '' || password.trim() === '') {
    // Se estiverem vazios, retorna erro HTTP 400 (requisição inválida)
     return res.status(400).send('Usuário e senha são obrigatórios.');
  }   

    const query = "SELECT * FROM users WHERE username =?"


    db.get(query, [username,], (err, row) => {
        
        if (err) throw err;

        //1. Verificar se o usuário existe
        console.log("Query SELECT do cadastro:", JSON.stringify(row));
        if (row) {
            //2. Se o usuário existir e a senha é válida no BD, executar processo de login
            console.log(`Usuário: ${username} já cadastrado.`);
            res.redirect("/ja-cadastrado");
        } else {
            //3. Se não, executar processo de negação de login
            const insert = "INSERT INTO users (username, password) VALUES (?,?)"
            db.get(insert, [username, password], (err, row) => {
                if (err) throw err;

                console.log(`Usuário: ${username} cadastrado com sucesso.`)
                res.redirect("/login");
            })
        }
          


    })

    //res.render("./pages/login");
})

app.get("/login", (req, res) => {
    console.log("GET /login")
    res.render("./pages/login", { titulo: "Login", req: req });
});

app.post("/login", (req, res) => {
    console.log("POST /login")
    console.log(JSON.stringify(req.body));
    const { username, password } = req.body;

    const query = "SELECT * FROM users WHERE username=? AND password=?"
    db.get(query, [username, password], (err, row) => {
        if (err) throw err;

        //1. Verificar se o usuário existe
        console.log(JSON.stringify(row));
        if (row) {
            console.log("SELECT da tabela users: ", row);
            //2. Se o usuário existir e a senha é válida no BD, executar processo de login
            req.session.username = username;
            req.session.loggedin = true;
            req.session.id_username = row.id;
            res.redirect("/dashboard");
        } else {
            //3. Se não, executar processo de negação de login
            res.redirect("/incorreto");
        }


    })

    //res.render("./pages/login");
});

app.get("/post_create", (req, res) =>{
    console.log("GET /post_create");
    //verificar se o usuário está logado
    //se estiver logado, envie o formulário para a criação do post
    if(req.session.loggedin){
        res.render("pages/post_form", {titulo: "Criar postagem", req: req})
    } else {  // se não estiver logado, redirect para /nao-autorizado
        res.redirect("/nao-autorizado")
    }
    
});

app.post("/post_create", (req, res) =>{
    console.log("POST /post_create");
    //Pegar dados da postagem: UserID, Titulo Postagem, Conteúdo da postagem, Data da postagem

    //req.session.username, req.session.id_username
    if(req.session.loggedin){
    console.log("Dados da postagem: ", req.body);
    const { titulo, conteudo} = req.body;
       if (!titulo || !conteudo || titulo.trim() === '' || conteudo.trim() === '') {
    // Se estiverem vazios, retorna erro HTTP 400 (requisição inválida)
     return res.status(400).send('Usuário e senha são obrigatórios.');
  }   

    const data_criacao = new Date();
    const data = data_criacao.toLocaleDateString();
    console.log("Data da criação:", data, "Username: ", req.session.username, "id_username: ", req.session.id_username);

    const query = "INSERT INTO posts (id_users, titulo, conteudo, data_criacao) VALUES (?, ?, ?, ?)"

    db.get(query, [req.session.id_username, titulo, conteudo, data], (err) =>{
        if(err) throw err;
        res.redirect('/tabela-posts');
    })

    } else {
        res.redirect("/nao-autorizado");
    }
})

app.get("/logout", (req, res) =>{
    console.log("GET /logout");
    req.session.destroy(() =>{
        res.redirect("/");
    });
});

app.get("/dashboard", (req, res) => {
    console.log("GET /dashboard")
    //res.render("./pages/dashboard", {titulo: "Dashboard"});
    //Listar todos os usurios
    if(req.session.loggedin){
    const query = "SELECT * FROM users";
    db.all(query, [], (err, row) => {
        if (err) throw err;
        console.log(JSON.stringify(row));
        res.render("pages/dashboard", { titulo: "Tabela de usuários", dados: row, req: req });
    })
    } else {
        res.redirect("/nao-autorizado");
    }
});

app.get("/tabela-posts", (req, res) => {
    console.log("GET /tabela-posts")
    //res.render("./pages/dashboard", {titulo: "Dashboard"});
    //Listar todos os usurios
    //if(req.session.loggedin){
    const query = "SELECT * FROM posts";
    db.all(query, [], (err, row) => {
        if (err) throw err;
        console.log(JSON.stringify(row));
        res.render("pages/tabela-posts", { titulo: "Tabela de posts", dados: row, req: req });
    })
    //} else {
        //res.redirect("/nao-autorizado");
    //}
});

app.get("/nao-autorizado", (req, res) => {
    res.render("./pages/nao-autorizado", { titulo: "Não Autorizado", req: req });
    console.log("GET /nao-autorizado");
});

app.get("/ja-cadastrado", (req, res) => {
    res.render("./pages/ja-cadastrado", { titulo: "Já Cadastrado", req: req });
    console.log("GET /ja-cadastrado");
});

app.get("/incorreto", (req, res) => {
    res.render("./pages/incorreto", { titulo: "Usuário ou senha incorretos", req: req });
    console.log("GET /incorreto");
});

app.get("/cadastro-com-sucesso", (req, res) => {
    res.render("./pages/cadastro-com-sucesso", { titulo: "Cadastro com Sucesso", req: req });
    console.log("GET /cadastro-com-sucesso");
});

app.use('/{*erro}', (req, res) => {
    res.status(404).render('./pages/erro404', { titulo: "ERRO 404", req: req, msg: "404" });
  });

app.listen(PORT);

app.listen(PORT, () => {
    console.log(`Servidor sendo executado na porta ${PORT}`);
    console.log(__dirname + "\\static");
});