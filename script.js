let excelData = [];

document.getElementById("excelFile").addEventListener("change", (e) => {

    const file = e.target.files[0];

    const reader = new FileReader();

    reader.onload = (event) => {

        const data = new Uint8Array(event.target.result);

        const workbook = XLSX.read(data, {
            type: "array"
        });

        const sheet =
            workbook.Sheets[workbook.SheetNames[0]];

        excelData =
            XLSX.utils.sheet_to_json(sheet);

        console.log(excelData);
    };

    reader.readAsArrayBuffer(file);
});

document.getElementById("analyzeBtn").addEventListener("click", async () => {

    const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            data: excelData
        })
    });

    const result = await response.json();

    document.getElementById("output").textContent =
        result.analysis;
});
