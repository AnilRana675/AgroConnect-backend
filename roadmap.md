AgroConnect Nepal – Personalized Agriculture Support Platform for Nepali Farmers

💡 Core Idea:
AgroConnect Nepal is a smart web/mobile platform designed to support different types of farmers across Nepal by providing personalized weekly agricultural information and a clear AI-powered roadmap for future innovation.

🔑 Key Features:
✅ Phase 1 – Current Hackathon Prototype
Farmer Type Identification at Login
Upon login/registration, the app asks key questions (e.g., land type, location, crops grown) to identify the type of farmer:

Subsistence farmer

Commercial grower

Youth agri-entrepreneur

Livestock/poultry farmer

Weekly Personalized Updates

Crop-specific tips based on location and season

Pest/disease alerts

Weather forecasts

Govt. seed/pesticide availability (mock data)

Info in Nepali (text, and optionally voice or video)

🔮 Phase 2 – Future AI Integration (Your Roadmap)
AI Assistant (in Nepali):

Voice-based question answering using NLP

Conversational chatbot that understands local dialects and simple queries

Image Recognition Tool:

Farmers can upload photos of diseased crops

AI model identifies crop diseases and provides remedies

Yield Prediction & Smart Planning:

Based on soil, crop history, and geolocation data

Landing page
Login page
User page

Questions in log-in page:
introduction
First name
Middle name(optional)
Last name
Type of farmer(with categories)
Farmar region(with categories)
Email and password

# API example:

{
"user": {
"personalInfo": {
"firstName": "Sita",
"middleName": "",
"lastName": "Rai"
},
"locationInfo": {
"state": "Koshi Province",
"district": "Dhankuta",
"municipality": "Dhankuta Municipality"
},
"farmInfo": {
"farmerType": "Horticulturist",
"economicScale": "Semi-Commercial"
},
"loginCredentials": {
"email": "sita.rai@example.com",
"password": "SecurePass!456"
}
}
}

#API format:
{
"user": {
"personalInfo": {
"firstName": "string",
"middleName": "string_optional",
"lastName": "string"
},
"locationInfo": {
"state": "string_enum",
"district": "string_enum",
"municipality": "string_enum"
},
"farmInfo": {
"farmerType": "enum",
"economicScale": "enum"
},
"loginCredentials": {
"email": "string_email",
"password": "string_password"
}
}
}

#questions:
Step 1: What is your Name?
Step 2: Which area are you located in?[state, district, municipality]
Step 3: What type of agriculture are you primarily involved in?
Step 4: What is the economic scale of your agriculture?
Step 5: What is your Email Address?
Step 6: Create a Password for your account.

#things to improve:
→ after user logs in to the website:
Let’s help you get started… [select between i am starting, i have already started, what i want to do]
Work with user prompts to predict what the user wants to do and help
