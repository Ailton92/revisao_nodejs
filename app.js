const express = require("express");
const session = require("express-session");
const sqlite3 = require("sqlite3");
const helmet = require("helmet");
const cors = require("cors");
const bodyparser = require("body-parser");

//const bodyparser = require("body-parser");

const app = express();

app.use(helmet())
app.use(bodyparser.json({limit:"3mb"}))

const PORT = 8000;

//Conexao com o BD
const db = new sqlite3.Database("users.db");

const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');

db.serialize(() => {
    db.run(
        "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, password TEXT, perfil TEXT(3))"
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

app.post("/cadastro", [
    // Validação dos campos
    body('username')
        .isAlphanumeric().withMessage('Usuário deve conter apenas letras e números.')
        .trim().escape(),
    body('password')
        .isLength({ min: 3 }).withMessage('A senha deve ter pelo menos 3 caracteres.')
        .trim()
], async (req, res) => {
    console.log("POST /cadastro");
    console.log(JSON.stringify(req.body));

    // Verifica erros de validação
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log("Erros de validação:", errors.array());
        return res.status(400).send('Dados inválidos: ' + errors.array().map(e => e.msg).join(', '));
    }

    const { username, password } = req.body;

    const query = "SELECT * FROM users WHERE username = ?";
    db.get(query, [username], async (err, row) => {
        if (err) {
            console.error("Erro na consulta SELECT:", err);
            return res.status(500).send("Erro no servidor");
        }

        if (row) {
            console.log(`Usuário: ${username} já cadastrado.`);
            return res.redirect("/ja-cadastrado");
        }

        // Cria hash da senha com bcrypt
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const perfil = "usr"

        const insert = "INSERT INTO users (username, password, perfil) VALUES (?, ?, ?)";
        db.run(insert, [username, hashedPassword, perfil ], function (err) {
            if (err) {
                console.error("Erro ao inserir usuário:", err);
                return res.status(500).send("Erro ao cadastrar");
            }

            console.log(`Usuário: ${username} cadastrado com sucesso.`);
            res.redirect("/login");
        });
    });
});

app.get("/login", (req, res) => {
    console.log("GET /login")
    res.render("./pages/login", { titulo: "Login", req: req });
});

app.post("/login", [
  body('username').isAlphanumeric().withMessage('Usuário inválido').trim().escape(),
  body('password').isLength({ min: 3 }).withMessage('Senha inválida').trim()
], (req, res) => {
  console.log("POST /login");
  console.log(JSON.stringify(req.body));

  //  Verifica se os dados passaram na validação
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log("Erros de validação:", errors.array());
    return res.redirect("/incorreto"); // Página de erro de login
  }

  const { username, password } = req.body;

  //  Busca o usuário pelo username (sem comparar senha ainda)
  const query = "SELECT * FROM users WHERE username = ?";
  db.get(query, [username], async (err, row) => {
    if (err) {
      console.error("Erro no banco:", err);
      return res.status(500).send("Erro interno no servidor");
    }

    // Se o usuário não existe
    if (!row) {
      console.log("Usuário não encontrado.");
      return res.redirect("/incorreto");
    }

    try {
      //  Compara a senha digitada com o hash salvo
      const match = await bcrypt.compare(password, row.password);

      if (match) {
        // Senha correta
        req.session.username = username;
        req.session.loggedin = true;
        req.session.id_username = row.id;
        req.session.perfil = row.perfil;

        if (row.perfil == "adm") {
          req.session.adm = true;
          return res.redirect("/dashboard"); // Rota exclusiva para admin
        } else {
          req.session.adm = false;
          return res.redirect("/"); // Página padrão do usuário
        }
      } else {
        console.log("Senha incorreta.");
        return res.redirect("/incorreto");
      }

    } catch (compareError) {
      console.error("Erro ao comparar senhas:", compareError);
      return res.status(500).send("Erro interno ao verificar senha");
    }
  });
});


app.get("/post_create", (req, res) => {
    console.log("GET /post_create");
    //verificar se o usuário está logado
    //se estiver logado, envie o formulário para a criação do post
    if (req.session.loggedin) {
        res.render("pages/post_form", { titulo: "Criar postagem", req: req })
    } else {  // se não estiver logado, redirect para /nao-autorizado
        res.redirect("/nao-autorizado")
    }

});

app.post("/post_create", (req, res) => {
    console.log("POST /post_create");
    //Pegar dados da postagem: UserID, Titulo Postagem, Conteúdo da postagem, Data da postagem

    //req.session.username, req.session.id_username
    if (req.session.loggedin) {
        console.log("Dados da postagem: ", req.body);
        const { titulo, conteudo } = req.body;
        if (!titulo || !conteudo || titulo.trim() === '' || conteudo.trim() === '') {
            // Se estiverem vazios, retorna erro HTTP 400 (requisição inválida)
            return res.status(400).send('Usuário e senha são obrigatórios.');
        }

        const data_criacao = new Date();
        const data = data_criacao.toLocaleDateString();
        console.log("Data da criação:", data, "Username: ", req.session.username, "id_username: ", req.session.id_username);

        const query = "INSERT INTO posts (id_users, titulo, conteudo, data_criacao) VALUES (?, ?, ?, ?)"

        db.get(query, [req.session.id_username, titulo, conteudo, data], (err) => {
            if (err) throw err;
            res.redirect('/tabela-posts');
        })

    } else {
        res.redirect("/nao-autorizado");
    }
})

app.get("/logout", (req, res) => {
    console.log("GET /logout");
    req.session.destroy(() => {
        res.redirect("/");
    });
});

app.get("/dashboard", (req, res) => {
    console.log("GET /dashboard")
    //res.render("./pages/dashboard", {titulo: "Dashboard"});
    //Listar todos os usurios
    if (req.session.adm) {
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

//Senha do usuario é 123456