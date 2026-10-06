(function () {
  // Yahan apni details badlo (yahi sirf ek jagah hai)
  var CREDIT = {
    name: 'Vishal',
    line: 'Diploma Computer Engineering, K. D. Polytechnic, Patan (GTU)',
    linkedin: 'https://www.linkedin.com/in/gjcompvishal053',
  };

  var style = document.createElement('style');
  style.textContent =
    'body{padding-bottom:44px !important}' +
    '#devCredit{position:fixed;left:12px;bottom:10px;z-index:900;max-width:calc(100vw - 90px);' +
    'font:12px system-ui,-apple-system,sans-serif;color:#94a3b8;line-height:1.4}' +
    '#devCredit b{color:#f8fafc}' +
    '#devCredit a{color:#3b82f6;text-decoration:none}';
  document.head.appendChild(style);

  var box = document.createElement('div');
  box.id = 'devCredit';

  var by = document.createElement('span');
  by.textContent = 'Developed by ';
  var nm = document.createElement('b');
  nm.textContent = CREDIT.name;
  by.appendChild(nm);
  box.appendChild(by);

  if (CREDIT.linkedin) {
    box.appendChild(document.createTextNode(' | '));
    var a = document.createElement('a');
    a.href = CREDIT.linkedin;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = 'LinkedIn';
    box.appendChild(a);
  }

  box.appendChild(document.createElement('br'));
  box.appendChild(document.createTextNode(CREDIT.line));

  document.body.appendChild(box);
})();
