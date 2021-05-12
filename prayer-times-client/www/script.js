const STORAGE_KEY = "prayer_entries";
var entries = [];
loadEntries();

window.onload = () => {
    displayEntries();

}

function ShowModal(id) {
    document.getElementById(id).style.display = "block";
    document.getElementById(id).style.overflow = "auto";
    document.body.style.overflow = "hidden";
    resetFields();
}

function HideModal(id) {
    document.getElementById(id).style.display = "none";
    document.body.style.overflow = "auto";
    resetFields();
}

function isStringEmpty(str) {
    return str.trim().replace(/ /g, "") == "";
}

function AddNewEntry() {
    let ip = document.getElementById("ip_addr").value;
    let name = document.getElementById("name").value;
    if (isStringEmpty(ip)) { alert("IP Address is required to connect to device!"); return; }
    if (isStringEmpty(name)) { name = "Unknown"; }


    let new_entry = {
        'id': getLatestID(),
        'ip': ip,
        'name': name,
    }

    entries.push(new_entry);
    displayEntries();
    saveEntries();
    HideModal('new_entry');
    resetFields();
}

function getLatestID(){
    let highest = 0;
    for(let i = 0; i < entries.length; i++){
        if(entries[i]['id'] > highest){
            highest = entries[i]['id'];
        }
    }
    return highest + 1;
}

function resetFields() {
    document.getElementById("ip_addr").value = "";
    document.getElementById("name").value = "";
}

function displayEntries() {
    document.getElementById("container").innerHTML = "";
    entries.forEach(item => {
        let main_div = document.createElement("div");
        main_div.classList.add('card');
        main_div.innerHTML = `
            <span class="close" onclick="removeEntry(${item['id']})">&times;</span>
            <h1>${item['name']}</h1>
            <h3>${item['ip']} - ${item['id']}</h3>
        `;
        main_div.addEventListener('click', (e) => { if (e.target.classList.contains("close")) { return; } loadConfigPage(item['ip']); });
        document.getElementById("container").append(main_div);
    });
}

function removeEntry(id) {
    for (let i = 0; i < entries.length; i++) {
        if (entries[i]["id"] == id) {
            entries.splice(i, 1);
            continue;
        }
    }

    saveEntries();
    displayEntries();
}

function loadConfigPage(ip_addr) {
    var ref = window.open(`http://${ip_addr}:9000/config`);
}

function saveEntries() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function loadEntries() {
    entries = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (entries == null || entries == undefined) { entries = []; }
}