import CreateAxiosClient from "../configurations/globalAxiosConfiguration.js";


const BaseURL = "http://localhost:8000/api";    //!USE LOCALHOST FOR SAME-SITE COOKIES OMG, NOT 127.0.0.1
export const axiosClient = CreateAxiosClient(BaseURL);


const navbarLoginBtn = document.querySelector(".login-btn-popup");
const coverBox = document.querySelector(".cover-box");
const loginLink = document.querySelector(".login-link");
const registerLink = document.querySelector(".register-link");
const iconClose = document.querySelector(".icon-close")


navbarLoginBtn.addEventListener("click", async () => {
    coverBox.classList.add("active-popup");
});

loginLink.addEventListener("click", async () => {
    coverBox.classList.remove("active");
    //login card is cover box's inactive state
});

registerLink.addEventListener("click", async () => {
    coverBox.classList.add("active");
    //register card is cover box's active state
});

iconClose.addEventListener("click", async () => {
    coverBox.classList.remove("active-popup");
});

/*
?maybe make the login popup button's text switch between login & register based on which card is currently on display
?or maybe change the login popup button's functionality to submit the form based on which card is currently on display
?or maybe make the login popup button disappear once it's been clicked
*/


const registrationForm = document.getElementById("registration-form");
const loginForm = document.getElementById("login-form");

const setToken = (token) => {
    localStorage.setItem("access_token", token);
};

const handleError = (error) => {
    if (error?.pydanticErrors) {
        displayPydanticError(error.pydanticErrors);
    } else {
        console.error(error?.message ?? error);
        alert(error?.message ?? String(error));
    }
};

export function displayPydanticError(pydanticErrorObject){
    for (const [errorLoc, errorMsg] of Object.entries(pydanticErrorObject)) {
        console.error(errorLoc, errorMsg);
        const errorElements = document.getElementsByName(errorLoc);
        if (errorElements.length > 0) {
            errorElements[0].value = errorMsg;
            errorElements[0].style.borderColor = "red";
        }
        else {
            alert(`error at ${errorLoc}, ${errorMsg}`)
        }
    }
}

const loginWithCredentials = async (email, password) => {
    const oAuth2Params = new URLSearchParams();
    oAuth2Params.append("username", email);
    oAuth2Params.append("password", password);
    oAuth2Params.append("grant_type", "password");

    console.log("oAuth2Params", oAuth2Params.toString());

    const response = await axiosClient.post(
        "/auth/login/",
        oAuth2Params, 
        {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
        }
    );

    const token = response.data?.access_token;
    if (!token) throw new Error("No access token received");
    setToken(token);

    coverBox.classList.remove("active-popup");
    //->add loading screen before redirect, maybe use timeout()
    window.location.href = "../dashboard.html";
};

registrationForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
        const formData = Object.fromEntries(new FormData(registrationForm).entries());
        await axiosClient.post("/auth/register/", formData);

        alert("Registration successful! Logging you in...");
        await loginWithCredentials(formData.email, formData.password);
    } catch (error) {
        handleError(error);
    }
});

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
        const formData = new FormData(loginForm);
        await loginWithCredentials(formData.get("user_email"), formData.get("user_password"));
    } catch (error) {
        handleError(error);
    }
});






