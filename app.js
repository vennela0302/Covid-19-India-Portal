const express = require("express");
const app = express();
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

app.use(express.json());

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

// API1
app.post("/login/", async (req, res) => {
  const { username, password } = req.body;
  const getUserDetails = `SELECT * FROM user WHERE username= '${username}';`;
  const dbUser = await db.get(getUserDetails);
  if (dbUser === undefined) {
    res.status(400);
    res.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = await jwt.sign(payload, "my_secret_key");
      res.send({ jwtToken });
      console.log(jwtToken);
    } else {
      res.status(400);
      res.send("Invalid password");
    }
  }
});

const authenticateToken = (req, res, next) => {
  let jwtToken;
  const authHeader = req.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    res.status(401);
    res.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "my_secret_key", async (error, payload) => {
      if (error) {
        res.status(401);
        res.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};
// API2
const convertDbObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
  };
};
app.get("/states/", authenticateToken, async (req, res) => {
  const getStatesQuery = `
    SELECT * FROM state;`;
  const getStates = await db.all(getStatesQuery);
  res.send(getStates.map((eachState) => convertDbObject(eachState)));
});

// API3
app.get("/states/:stateId/", authenticateToken, async (req, res) => {
  const { stateId } = req.params;
  const getStateQuery = `
    SELECT * FROM state WHERE state_id = ${stateId};`;
  const getState = await db.get(getStateQuery);
  res.send(convertDbObject(getState));
});

// API4
app.post("/districts/", authenticateToken, async (req, res) => {
  const { districtName, stateId, cases, cured, active, deaths } = req.body;
  const createDistQuery = `
  INSERT INTO district ('district_name', 'state_id', 'cases', 'cured', 'active', 'deaths')
  VALUES ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`;
  db.run(createDistQuery);
  res.send("District Successfully Added");
});

// API5
app.get("/districts/:districtId/", authenticateToken, async (req, res) => {
  const { districtId } = req.params;
  const getDistQuery = `
    SELECT * FROM district WHERE district_id = ${districtId};`;
  const getDist = await db.get(getDistQuery);
  res.send(convertDbObject(getDist));
});

// API6
app.delete("/districts/:districtId/", authenticateToken, async (req, res) => {
  const { districtId } = req.params;
  const delDistQuery = `
    DELETE FROM district WHERE district_id = ${districtId};`;

  await db.run(delDistQuery);
  res.send("District Removed");
});

// API 7
app.put("/districts/:districtId/", authenticateToken, async (req, res) => {
  const { districtId } = req.params;
  const { districtName, stateId, cases, cured, active, deaths } = req.body;
  const updateDistQuery = `
    UPDATE district 
    SET  district_name = '${districtName}',
    state_id=${stateId},cases=${cases},cured=${cured},active=${active},deaths=${deaths}
    WHERE district_id = ${districtId};`;
  await db.run(updateDistQuery);
  res.send("District Details Updated");
});

// API8
app.get("/states/:stateId/stats/", authenticateToken, async (req, res) => {
  const { stateId } = req.params;
  const getStatsQuery = `
  SELECT SUM(cases),SUM(cured), SUM(active), SUM(deaths) FROM district WHERE state_id = ${stateId}`;
  const stats = await db.get(getStatsQuery);
  res.send({
    totalCases: stats["SUM(cases)"],
    totalCured: stats["SUM(cured)"],
    totalActive: stats["SUM(active)"],
    totalDeaths: stats["SUM(deaths)"],
  });
});

module.exports = app;
