
const HOST = 'https://devimages.golos.today';

const ACC = 'xel';
// private key of acc - posting or active
const KEY = '5K1aJ8JayUA7c2Ptg9Y2DetKxSvXGXa5GCcvYeHtn1Xh3v4egPS';
// these keys can be extracted from password, see golos-lib-js docs

document.getElementById('form1').onsubmit = (e) => {
    e.preventDefault();
    const files = document.getElementsByClassName('file')[0].files;
    if (!files.length) {
        alert('No file selected');
        return false;
    }
    const file = files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
        let data = e.target.result;
        data = new Uint8Array(data);
        const signatures = golos.auth.signData(data, { key: KEY });

        const formData = new FormData();
        formData.append('image', file);

        const uploadURL = new URL('/@' + ACC + '/' + signatures.key, HOST)
        let resp = await fetch(uploadURL, {
            method: 'POST',
            body: formData,
        })
        resp = await resp.json();
        alert(JSON.stringify(resp))
    }
    reader.readAsArrayBuffer(file);

    return false;
}

