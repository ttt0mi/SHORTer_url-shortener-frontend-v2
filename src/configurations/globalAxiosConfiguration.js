import axios from "axios";
import axiosRetry from "axios-retry";


let isRefreshing = false;


//handle pydantic errors
function FormatValidationErrors(errors) {
	const formattedErrors = {};
	if (!Array.isArray(errors)) {
		return {
			detail: "An unknown error occurred in your input.",
		};
	}
	errors.forEach(error => {
		formattedErrors[error.loc.at(-1)] = error.msg;
	});
	return formattedErrors;
}


export function logout(){
    localStorage.removeItem("access_token");
    alert("Your session has expired. Please log in again.");
    window.location.href = "../index.html"; //change this to the main page
}


export default function CreateAxiosClient(BaseURL) {
	const axiosClient = axios.create({
		baseURL: BaseURL,
        withCredentials: true,
		timeout: 5000,
		timeoutErrorMessage: "Request timed out. Please try again.",
		headers: {
			"Content-Type": "application/json",
		},
	});


    axiosRetry(axiosClient, { 
        retries: 2,
        retryDelay: axiosRetry.exponentialDelay,
        retryCondition: (error) => {
            return error.response && error.response.status === 401;
        },
        shouldResetTimeout: true,
        onRetry: async (retryCount, error, requestConfig) => {
            if (error.response && error.response.status === 401 && !isRefreshing) {
                console.log(`access token expired. attempting to refresh token. Retry count: ${retryCount}`);
                isRefreshing = true;

                try {
                    const response = await axiosClient.post("/auth/refresh");
                    let token = response.data.access_token;
                    localStorage.setItem("access_token", token);
                    requestConfig.headers['Authorization'] = `Bearer ${token}`;
                }
                catch (refreshError) {
                    console.log("Failed to refresh token", refreshError);//for me
                    logout();
                }
                finally {
                    isRefreshing = false;
                }
            }
        }
    });


    axiosClient.interceptors.request.use(config => {
		const token = localStorage.getItem("access_token");
        if(!token) return config;

        config.headers.Authorization = `Bearer ${token}`;
		return config;
    },
    error => {
        return Promise.reject(error);
    });


	axiosClient.interceptors.response.use(
		response => {
			return response;
		},
		error => {
			if (error.response) {
				const { status, data } = error.response;

				if (status === 400) {
					console.error("Bad Request:", data.detail);
					error.message = data.detail;
				} else if (status === 404) {
					console.error("Not Found:", data.detail);
					error.message = data.detail;
				} else if (status === 422) {
					const formattedErrors = FormatValidationErrors(data.detail);
					console.error("Validation Error:", formattedErrors);
					error.pydanticErrors = formattedErrors;
				} else if (status === 423) {
					console.error("Resource Locked:", data.detail);
					error.message = data.detail;
				} else if (status === 500) {
					console.error("Server Error:", data.detail);
					error.message = data.detail;
				} else if (status === 503) {
					console.error(
						"Service Temporarily Unavailable:",
						data.detail
					);
					error.message = data.detail;
				}
			} else if (error.request) {
				console.error(
					"Network Error: Sever could not process the request.",
					error.message
				);
			} else {
				console.error("Request setup error:", error.message);
			}
			return Promise.reject(error);
		}
	);

	return axiosClient;
}
