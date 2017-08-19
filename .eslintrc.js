module.exports = {
    "extends": "airbnb-base",
    "plugins": [
        "import"
    ],
    "overrides": [
        {
            "files": ["./spec/*.js"],
            "excludedFiles": ["./spec/*.spec.js"],
        }
    ]
};