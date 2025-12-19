import {axiosClient, displayPydanticError} from './index.js';


const urlSubmissionBtn = document.getElementById("url-submission-btn");
const urlSubmissionInput = document.getElementById("url-submission-input");


const linkSectionLinkText = document.querySelector(".link-as-text-card p");
const linkSectionQrImage = document.querySelector(".link-as-qrcode-card img");
const linkSectionQrSpinner = document.querySelector(".link-as-qrcode-card div");

const shortLinkValue = document.getElementById("short-link-value");
const originalLinkValue = document.getElementById("original-link-value");
const clicksValue = document.getElementById("clicks-value");
const statusToggleBtn = document.getElementById("status-toggle-btn");
const dateCreatedValue = document.getElementById("date-created-value");
const lastModifiedValue = document.getElementById("last-modified-value");

const historyTableBody = document.querySelector(".history-content-table tbody");

const linkSectionBtn = document.getElementById("link-selection");
const statsSectionBtn = document.getElementById("statistics-selection");
const historySectionBtn = document.getElementById("history-selection");

const linkContent = document.getElementById("link-content");
const statsContent = document.getElementById("statistics-content");
const historyContent = document.getElementById("history-content");


async function loadUserDetails() {
    try {
        const response = await axiosClient.get("/auth/current/");
        const currentUserData = response.data;
        document.getElementById("user-first-name").textContent = currentUserData.first_name;
        document.getElementById("user-avatar").textContent = currentUserData.first_name[0];

        await loadUserHistory();
    } catch(error) {
        console.error("Failed to fetch user details:", error);
        alert("Unable to load user details. Please try again later.");
    }
}

//*This is for switching between sections
const sectionButtons = {
    link: linkSectionBtn,
    statistics: statsSectionBtn,
    history: historySectionBtn,
};

function showSection(sectionName) {
    linkContent.hidden = sectionName !== "link";
    statsContent.hidden = sectionName !== "statistics";
    historyContent.hidden = sectionName !== "history";

    Object.keys(sectionButtons).forEach(section => {
        if(section === sectionName) sectionButtons[section].classList.add("active");
        else sectionButtons[section].classList.remove("active");
    });
}

const checkCurrentSection = () => {
    return Object.keys(sectionButtons).find(section => sectionButtons[section].classList.contains("active"));
}

linkSectionBtn.addEventListener("click", () => showSection("link"));
statsSectionBtn.addEventListener("click", () => showSection("statistics"));
historySectionBtn.addEventListener("click", () => showSection("history"));


//*this is all for QR Code stuff
let currentLinkPageQRCodeUrl = null;
const qrObjectUrlMap = new Map();


async function getQRCodeImageSrc(/** @type {string} */shortCode) {
    try {
        const response = await axiosClient.get(`/sh/qr/${shortCode}`, {
            responseType: "blob",
        });

        const image_data_as_blob = response.data;
        const qrcodeUrl = URL.createObjectURL(image_data_as_blob);
        qrObjectUrlMap.set(shortCode, qrcodeUrl);
        return qrcodeUrl;
    } catch(error) {
        console.error("Failed to fetch QR:", error);
        return "../assets/vectors/question.svg"; // change this to an actual image for defaults
    }
}


async function setLinkPageQRCode(shortCode) {
    if(currentLinkPageQRCodeUrl) {
        try {
            URL.revokeObjectURL(currentLinkPageQRCodeUrl);
        } catch {
            console.log("bruh, the bugger is still there. failed to revoke object URL")
        }
    }
    const qrUrl = await getQRCodeImageSrc(shortCode);
    linkSectionQrImage.src = qrUrl;
    currentLinkPageQRCodeUrl = qrUrl;
}


const qrObserver = new IntersectionObserver(
    entries => {
        entries.forEach(async entry => {
            if(!entry.isIntersecting) return;

            const img = entry.target;
            const shortCode = img.dataset.shortCode;
            if(!shortCode) {
                qrObserver.unobserve(img);
                return;
            }

            const qrUrl = await getQRCodeImageSrc(shortCode);
            img.src = qrUrl;
            qrObserver.unobserve(img);
        });
    },
    {root: null, rootMargin: "10%", threshold: 0.05}
);


function clearQrUrlsInMemory() {
    for(const url of qrObjectUrlMap.values()) {
        try {
			URL.revokeObjectURL(url);
		} catch {
			console.log("bruh, the bugger is still there. failed to revoke object URL");
		}
    }
    qrObjectUrlMap.clear();
}
//*end of most qrcode stuff, might delete, too much brain power used


urlSubmissionBtn.addEventListener("click", async () => {
    const originalUrl = urlSubmissionInput.value.trim();
    if(!originalUrl) {
        //->maybe change this to an inline error(red border, etc)
        alert("aje enter a URL.");
        return;
    }

    linkSectionQrSpinner.style.display = "block";
    linkSectionQrImage.style.display = "none";
    try {
        const response = await axiosClient.post("/sh/", {
            original_url: originalUrl,
        });

        const currentShortCode = response.data.short_code;
        linkSectionLinkText.textContent = response.data.short_url;

        await setLinkPageQRCode(currentShortCode);//*for link page
        await loadUrlInfo(response.data.short_code);//*for stats page
        await loadUserHistory();//*for history page

        urlSubmissionInput.value = "";
        linkSectionQrSpinner.style.display = "none";
        linkSectionQrImage.style.display = "block";
    } catch (error) {
        linkSectionQrSpinner.style.display = "none";
        linkSectionQrImage.style.display = "block";
        if (error.pydanticErrors){
            displayPydanticError(error.pydanticErrors);
        } else{
            console.error(error.message);
            alert(error.message || "failed to shorten URL");
        }
    }
});


async function loadUrlInfo(shortCode) {
    try {
        const response = await axiosClient.get(`/sh/${shortCode}/info`);
        const data = response.data;

        //->might change these 2 below to when they are clicked, they are copied to clipboard instead
        shortLinkValue.innerHTML = `<p><a href="${data.short_url}" target="_blank" rel="noopener">${data.short_url}</a></p>`;
        originalLinkValue.innerHTML = `<p><a href="${data.original_url}" target="_blank" rel="noopener">${data.original_url}</a></p>`;
        clicksValue.textContent = data.clicks ?? 0;
        dateCreatedValue.textContent = data.created_at ?? "N/A";
        lastModifiedValue.textContent = data.last_used_at ?? "N/A";

        updateStatusButton(data.active);
        statusToggleBtn.onclick = () =>
            toggleUrlStatus(shortCode, !data.active);
    } catch(error) {
        console.error("Failed to load url info:", error);
        alert(error.message || "Failed to retrieve URL info.");
    }
}


async function toggleUrlStatus(shortCode, isActive) {
    const path = isActive ? "enable" : "disable";
    try {
		await axiosClient.patch(`/sh/${path}/${shortCode}`);
		await loadUrlInfo(shortCode);
	} catch (error) {
		console.error("error", error);
		alert(error.message || "Failed to update status.");
	}
}


function updateStatusButton(isActive) {
    const icon = statusToggleBtn.querySelector("i");
    const p = statusToggleBtn.querySelector("p");
    if(!icon || !p) return;
    if(isActive) {
        icon.classList.remove("fa-toggle-off");
        icon.classList.add("fa-toggle-on");
        p.textContent = "Active";
    } else {
        icon.classList.remove("fa-toggle-on");
        icon.classList.add("fa-toggle-off");
        p.textContent = "Disabled";
    }
}


/*
->add update for all url status buttons in history. they have classname 'history-status'
*collect all rows in history table and add event listener for each one
*when user clicks on a row, extract the short code from it and set as the current short code
*use the currentShortCode global variable to update the url info status and load qr code
*/

let rowsFragment = document.createDocumentFragment()

async function loadUserHistory() {
    //a websocket would do wonders here but i cannot deal with mongodb's replica set bs
    try {
        clearQrUrlsInMemory();

        const response = await axiosClient.get("/sh/info/all");
        const urls = Array.isArray(response.data) ? response.data : [];

        historyTableBody.innerHTML = "";

        urls.forEach(urlInfo => {
            const row = document.createElement("tr");

            row.innerHTML = `
            <td id="history_short_url">
                <a href="${urlInfo.short_url}" target="_blank" rel="noopener">${urlInfo.short_url}</a>
            </td>
            <i class="fa-sharp fa-solid fa-copy" title="copy link"></i>
            <td class="history-original_url">
                <a href="${urlInfo.original_url}" target="_blank" rel="noopener">${urlInfo.original_url}</a>
            </td>
            <td id="history_QR_code" class="history-qr">
                <img data-short-code="${urlInfo.short_code}" src="../assets/vectors/question.svg" alt="QR" />
            </td>
            <td class="history-clicks">${urlInfo.clicks}</td>
            <td id="history_url-status">
                <span class="history-status ${urlInfo.active ? 'active' : 'inactive'}">
                    <i class="fa-sharp fa-solid fa-link${urlInfo.active ? '' : '-slash'}"></i> 
                    ${urlInfo.active ? "Active" : "Disabled"}
                </span>
            </td>
            <td id="history_created_at" class="date">${urlInfo.created_at ?? "N/A"}</td>
            <td id="history_last_used_at" class="date">${urlInfo.last_used_at ?? "N/A"}</td>
            `;

            const copyIcon = row.querySelector(".fa-copy");
            if(copyIcon) {
                copyIcon.addEventListener("click", () => {
                    navigator.clipboard.writeText(urlInfo.short_url);
                    showCopyNotification("Copied to clipboard!");
                });
            }

            const img = row.querySelector("#history_QR_code img");
            if(img) qrObserver.observe(img);

            rowsFragment.appendChild(row);
        });

        historyTableBody.appendChild(rowsFragment);
        
    } catch(error) {
        console.error("Failed to load history:", error);
        alert("Failed to load previous url information")
    }
}


//->Use this for other notifications instead of alerts
function showCopyNotification(message) {
    let notification = document.getElementById("copy-notification");
    if (!notification) {
        notification = document.createElement("div");
        notification.id = "copy-notification";
        notification.style.position = "fixed";
        notification.style.bottom = "30px";
        notification.style.left = "50%";
        notification.style.transform = "translateX(-50%)";
        notification.style.background = "#333";
        notification.style.color = "#fff";
        notification.style.padding = "10px 20px";
        notification.style.borderRadius = "6px";
        notification.style.fontSize = "1rem";
        notification.style.zIndex = "9999";
        notification.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
        notification.style.opacity = "0";
        notification.style.transition = "opacity 0.3s";
        document.body.appendChild(notification);
    }
    notification.textContent = message;
    notification.style.opacity = "1";
    setTimeout(() => {
        notification.style.opacity = "0";
    }, 1200);
}


document.addEventListener("DOMContentLoaded", async () => {
    checkCurrentSection() ?? showSection("link");
    await loadUserDetails();
});


//if (urlSubmissionBtn === null || urlSubmissionInput === null
//    || linkSectionLinkText === null || linkSectionQrImage === null
//    || linkSectionQrSpinner === null || linkSectionQrImage === null
//    || shortLinkValue === null || originalLinkValue === null
//    || clicksValue === null || dateCreatedValue === null
//    || lastModifiedValue === null || statusToggleBtn === null
//    || historyTableBody === null) {
//    console.error("Null pointer reference detected.");
//    return;
//}


