export const formatDate = (event) => {
    const input = event.target.value;
    const formattedDate = input
        .replace(/[^\d]/g, '') // Remove non-numeric characters
        .replace(
            /(\d{2})(\d{2})(\d{4})/,
            (match, month, day, year) => `${month}/${day}/${year}`
        );
    return formattedDate;
};
