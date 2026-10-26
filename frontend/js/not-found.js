(function () {
    // 始终保持同源跳转；fragment 在入口按公开文件清单验证。
    const target = new URL('/index.html', window.location.origin);
    target.hash = window.location.pathname.replace(/^\/(?:public\/)?/, '');
    if (target.hostname === 'cranecat.cn' || target.hostname === 'www.cranecat.cn') target.protocol = 'https:';
    const homeLink = document.getElementById('homeLink');
    if (homeLink) homeLink.href = target.href;
    window.location.replace(target.href);
})();
