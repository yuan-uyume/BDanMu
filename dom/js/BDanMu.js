import("/lib/jquery3.6.0")

function BDanMu(parentDom) {
    this.initFlag = false;
    this.pDom = parentDom;
    this.dom = null;
    this.time = 0;
    this.timeIndex = 0;
    this.timer = null;
    this.timerInterval = 100;
    this.danMuChi = [];
    this.channels = [[],[],[],[],[]];
    this.danMuDoms = [];
}

BDanMu.prototype.init = function () {
    if (!this.initFlag) {
        let p = $(this.pDom)
        if (p.length < 1) {
            this.log("找不到该元素", this.pDom);
            return ;
        }
        this.pDom = $(this.pDom);
        this.dom = $("<div id=\"bTanMu\"></div>")
        $(this.pDom).append(this.dom);
        $(this.dom).css({
            "opacity": "0.8",
            "font-min-size": "18px",
            "color": "whitesmoke",
            "background": "transparent",
            "height": "100%",
            "width": "100%",
            "overflow": "hidden",
            "position": "relative",
            "top": "-100%"
        });
        this.log("add", this.dom, "to", this.pDom);
        for (let cIdx in this.channels) {
            let pY = this.getChannelTop(cIdx);
            this.danMuDoms.push([]);
            for (let i = 0; i < 8; i++) {
                let dom = this.createNewTanMuDom(pY);
                $(dom).attr("super", cIdx);
                $(dom).on("transitionend", this.onDanMuEnd(this));
                this.danMuDoms[cIdx].push(dom);
            }
        }
        this.log("轨道弹幕复用池初始化", this.danMuDoms);
        this.initFlag = true;
    }
}

BDanMu.prototype.addXmlToDanMuChi = function (dom) {
    let data = $(dom).find("d")
    for (let d of data) {
        let dd = $(d).attr("p").split(",");
        this.danMuChi.push(this.newDanMu(dd[0],d.innerText))
    }
    this.sort();
    this.log("当前弹幕池", this.danMuChi)
}

BDanMu.prototype.newDanMu = function (time, value, size, color) {
    return {
        time: time,
        value: value,
        size: size,
        color: color
    };
}

BDanMu.prototype.selector = async function (tanMuChi) {
    // 0 获取应该发送的弹幕
    // 1 那个管道可以发射弹幕？
    // 2 该是否存在可复用的dom？
    // 3 发射dom
    // 4 dom运动完

    // tanMuChi.log("内部计时", tanMuChi.time);
    let needSendDanMuData = [];
    while (true) {
        if (tanMuChi.timeIndex >= tanMuChi.danMuChi.length) {
            tanMuChi.stop();
            return null;
        }
        let tanMuData = tanMuChi.danMuChi[tanMuChi.timeIndex];
        if (tanMuData.time > tanMuChi.time ) {
            // 如果弹幕未到发射时间，直接返回
            break;
        }
        if (tanMuData.time > tanMuChi.time + 1) {
            // 如果弹幕超时1s直接放弃发射，找下一个弹幕发射
            tanMuChi.timeIndex ++;
            continue;
        }
        tanMuData.tanMuChiIdx =tanMuChi.timeIndex;
        tanMuChi.timeIndex ++;
        needSendDanMuData.push(tanMuData);
    }

    if (needSendDanMuData.length > 0) {
        for (let tanMuData of needSendDanMuData) {
            for (let cIdx in tanMuChi.channels) {
                let channel = tanMuChi.channels[cIdx];
                if (cIdx < tanMuChi.channels.length - 1) {
                    let nextChannel = tanMuChi.channels[(parseInt(cIdx) + 1)];
                    if (channel.length > nextChannel.length) {
                        // 如果下一个轨道比这个空闲去下一个管道
                        continue;
                    }
                }
                if (channel.length > 0) {
                    let lastDanMu = channel[channel.length - 1];
                    let distance = tanMuChi.getTranslateX(lastDanMu);
                    if (isNaN(distance) || distance > $(lastDanMu).width()) {
                        tanMuChi.timeIndex ++;
                        tanMuChi.channelSend(cIdx, tanMuData);
                        break;
                    }
                } else {
                    tanMuChi.timeIndex ++;
                    tanMuChi.channelSend(cIdx, tanMuData);
                    break;
                }
            }
        }
    }
}

BDanMu.prototype.channelSend = function (idx, data) {
    // 通道可用，获取dom
    let dom = undefined;
    if (this.danMuDoms[idx].length > 0) {
        dom = this.danMuDoms[idx].shift();
    } else {
        dom = this.createNewTanMuDom(this.getChannelTop(idx));
    }
    $(dom).text(data.value);
    $(dom).attr("channel", idx);
    $(dom).attr("idx", data.tanMuChiIdx);
    this.channels[idx].push(dom);
    this.sendDanMu(dom);
}

BDanMu.prototype.getChannelTop = function (idx) {
    return 10 + 20 * idx + "px";
}

BDanMu.prototype.createNewTanMuDom = function (top) {
    let tanMu = $("<i></i>")
    $(this.dom).append(tanMu);
    $(tanMu).css({
        "user-select": "none",
        "white-space": "nowrap",
        "position": "absolute",
        "top": top,
        "left": "100%",
        'transition': 'transform 7s linear',
        'will-change': 'transform'
    })
    return tanMu;
}

BDanMu.prototype.getTranslateX = function (dom) {
    return - parseFloat($(dom).css("transform").substring(7).split(',')[4])
}

BDanMu.prototype.sendDanMu = function (dom) {
    let x = - $(this.dom).width() - $(dom).width() - 10 + "px";
    $(dom).css("transform", "translateX("+ x +")");
    let superIdx = $(dom).attr("super");
    if (superIdx === undefined) {
        $(dom).on("transitionend", this.onDanMuEnd(this));
    }
}

BDanMu.prototype.onDanMuEnd = function (tanMuchi) {
    return function () {
        let superIdx = $(this).attr("super");

        if (superIdx === undefined) {
            let idx = $(this).attr("channel");
            tanMuchi.log("tanMuEnd", "new" + idx, this.innerText);
            tanMuchi.channelRemove(tanMuchi.channels[idx], this);
            $(this).remove();
        } else {
            tanMuchi.log("tanMuEnd", "super" + superIdx, this.innerText);
            tanMuchi.channelRemove(tanMuchi.channels[superIdx], this);
            // 弹幕要复位
            $(this).css("transform","");
            $(this).css("transition","");
            tanMuchi.danMuDoms[superIdx].push(this)
            let dom = this;
            let timeout = setTimeout(() => {
                $(dom).css("transition","transform 7s linear");
                clearTimeout(timeout);
            }, 100)

        }
    }
}

BDanMu.prototype.channelRemove = function (channel, dom) {
    for (let i in channel) {
        if ($(channel[i]).attr("idx") === $(dom).attr("idx")) {
            channel.splice(i, 1);
            break;
        }
    }
}

BDanMu.prototype.sort = function () {
    this.danMuChi.sort((a, b) => {
        return a.time - b.time;
    })
}

BDanMu.prototype.start = function () {
    if (this.initFlag) {
        if (this.timer === null) {
            this.timer = setInterval(() => {
                // 模拟视频时间
                this.time = this.time + this.timerInterval / 1000;
                this.selector(this);
            }, this.timerInterval);
        }
    } else {
        this.log("未初始化，无法启动");
    }
}

BDanMu.prototype.stop = function () {
    try {
        this.log(this);
        clearInterval(this.timer);
        this.timer = null;
    } catch (e) {
        this.log(e)
    }
}

BDanMu.prototype.log = function (...data) {
    console.log("BTanMu：", data);
}

export default BDanMu;
