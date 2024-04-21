const search = require('./search');
const getSign = require('../util/sign');

const song = {
  '/': async ({req, res, request}) => {
    const url = 'http://u.y.qq.com/cgi-bin/musicu.fcg';
    const {songmid, raw, songid} = req.query;

    if (!songmid && !songid) {
      return res.send({
        result: 500,
        errMsg: 'songmid 不能为空',
      });
    }
    const data = {
      data: JSON.stringify({
        songinfo: {
          method: 'get_song_detail_yqq',
          module: 'music.pf_song_detail_svr',
          param: songmid? ({
            song_mid: songmid,
          }) : ({
            song_id: parseInt(songid),
          }),
        },
      }),
    };

    const result = await request({url, data});

    if (Number(raw)) {
      return res.send(result);
    }

    res &&
    res.send({
      result: 100,
      data: result.songinfo.data,
    });
    return result.songinfo.data;
  },

  '/url': async ({req, res, request, cache, globalCookie}) => {
    const obj = {...req.query, ...req.body};
    let {uin, qqmusic_key} = globalCookie.userCookie();
    if (Number(obj.ownCookie)) {
      uin = req.cookies.uin || uin;
    }

    const {id, type = '128', mediaId = id, isRedirect = '0'} = obj;
    const typeMap = {
      m4a: {
        s: 'C400',
        e: '.m4a',
      },
      128: {
        s: 'M500',
        e: '.mp3',
      },
      320: {
        s: 'M800',
        e: '.mp3',
      },
      ape: {
        s: 'A000',
        e: '.ape',
      },
      flac: {
        s: 'F000',
        e: '.flac',
      },
    };
    const typeObj = typeMap[type];

    if (!typeObj) {
      return res.send({
        result: 500,
        errMsg: 'type 传错了，看看文档去',
      });
    }
    if (!id) {
      return res.send({
        result: 500,
        errMsg: 'id ?',
      });
    }
    const file = `${typeObj.s}${id}${mediaId}${typeObj.e}`;
    const guid = (Math.random() * 10000000).toFixed(0);

    let purl = '';
    let count = 0;
    let cacheKey = `song_url_${file}`;
    let cacheData = cache.get(cacheKey);
    // if (cacheData) {
    //   return res.send(cacheData);
    // }
    let domain = '';
    while (!purl && count < 10) {
      count += 1;
      const result = await request({
        url: 'https://u.y.qq.com/cgi-bin/musicu.fcg',
        data: {
          '-': 'getplaysongvkey',
          g_tk: 5381,
          loginUin: uin,
          hostUin: 0,
          format: 'json',
          inCharset: 'utf8',
          outCharset: 'utf-8¬ice=0',
          platform: 'yqq.json',
          needNewCode: 0,
          data: JSON.stringify({
            req_0: {
              module: 'vkey.GetVkeyServer',
              method: 'CgiGetVkey',
              param: {
                filename: [file],
                guid: guid,
                songmid: [id],
                songtype: [0],
                uin: uin,
                loginflag: 1,
                platform: '20',
              },
            },
            comm: {
              uin: uin,
              format: 'json',
              ct: 19,
              cv: 0,
              authst: qqmusic_key,
            },
          }),
        },
      });
      if (res && !result.req_0.data) {
        return res.send({
          result: 400,
          errMsg: '获取链接出错，建议检查是否携带 cookie ',
        });
      }
      console.log(JSON.stringify(result))
      if (result.req_0 && result.req_0.data && result.req_0.data.midurlinfo) {
        purl = result.req_0.data.midurlinfo[0].purl;
      }
      if (domain === '') {
        domain =
          result.req_0.data.sip.find(i => !i.startsWith('http://ws')) ||
          result.req_0.data.sip[0];
      }
    }
    if (!purl) {
      return res.send({
        result: 400,
        errMsg: '获取播放链接出错',
      });
    }

    if (Number(isRedirect)) {
      return res.redirect(`${domain}${purl}`);
    }

    cacheData = {
      data: `${domain}${purl}`,
      result: 100,
    };
    res.send(cacheData);
    // cache.set(cacheKey, cacheData);
  },

  '/urls': async ({req, res, request, globalCookie, cache}) => {
    const obj = {...req.query, ...req.body};
    let uin = globalCookie.userCookie().uin;

    if (Number(obj.ownCookie)) {
      uin = req.cookies.uin || uin;
    }

    const {id = ''} = obj;
    const idArr = id.split(',');
    let count = 0;
    const idStr = idArr.map(id => `"${id}"`).join(',');

    let cacheKey = `song_url_${idStr}`;
    let cacheData = cache.get(cacheKey);
    if (cacheData) {
      return res.send(cacheData);
    }
    let url = `https://u.y.qq.com/cgi-bin/musicu.fcg?-=getplaysongvkey&g_tk=5381&loginUin=${uin}&hostUin=0&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0&data=%7B"req_0"%3A%7B"module"%3A"vkey.GetVkeyServer"%2C"method"%3A"CgiGetVkey"%2C"param"%3A%7B"guid"%3A"2796982635"%2C"songmid"%3A%5B${idStr}%5D%2C"songtype"%3A%5B0%5D%2C"uin"%3A"${uin}"%2C"loginflag"%3A1%2C"platform"%3A"20"%7D%7D%2C"comm"%3A%7B"uin"%3A${uin}%2C"format"%3A"json"%2C"ct"%3A24%2C"cv"%3A0%7D%7D`;
    let isOk = false;
    let result = null;

    const reqFun = async () => {
      count += 1;
      result = await request(url);
      if (result.req_0.data.midurlinfo[0].purl!=="") {
        isOk = true;
      }
    };

    while (!isOk && count < 5) {
      await reqFun().catch(() => (count += 1));
      console.log(count)
      console.log("result="+JSON.stringify(result))
    }

    console.log("result="+JSON.stringify(result))

    if (!result || !result.req_0) {
      return res.send({
        result: 200,
        errMsg: '获取链接失败，建议检查是否登录',
      });
    }

    const domain =
      result.req_0.data.sip.find(i => !i.startsWith('http://ws')) ||
      result.req_0.data.sip[0];

    // domain = 'http://122.226.161.16/amobile.music.tc.qq.com/';

    const data = {};
    result.req_0.data.midurlinfo.forEach(item => {
      if (item.purl) {
        data[item.songmid] = `${domain}${item.purl}`;
      }
    });

    console.log("data="+JSON.stringify(data))

    cacheData = {
      data,
      result: 100,
    };
    res.send(cacheData);
    cache.set(cacheKey, cacheData);
  },

  '/getPlayTopData': async ({req, res, request, globalCookie, cache}) => {
    const obj = {...req.query, ...req.body}
    const {id = ''} = obj

    let {uin, qqmusic_key} = globalCookie.userCookie();
    console.log("cookies="+JSON.stringify(globalCookie.userCookie()))
    // if (!uin || !(qm_keyst || qqmusic_key)) {
    //   return res.send({
    //     result: 301,
    //     errMsg: '未登陆'
    //   })
    // }
    const data = {
      req1: {
        module: "QQConnectLogin.LoginServer",
        method: "QQLogin",
        param: {
          expired_in: 7776000, //不用管
          // onlyNeedAccessToken: 0, //不用管
          // forceRefreshToken: 0, //不用管
          // access_token: "6B0C62126368CA1ACE16C932C679747E", //access_token
          // refresh_token: "25BACF1650EE2592D06BCC19EEAD7AD6", //refresh_token
          musicid: uin, //uin或者web_uin 微信没试过
          // musickey: qm_keyst || qqmusic_key, //key
          musickey: qqmusic_key //key
        },
      },
    };
    const sign = getSign(data)
    console.log("sign="+sign)

    const time=new Date().getTime()
    console.log("time="+time)

    const result = await request({
      url: `https://u6.y.qq.com/cgi-bin/musicu.fcg?_webcgikey=GetPlayTopData_HasPlayTopData&_=${time}`,
      data: {
        comm: {
          g_tk: 5381,
          uin: '',
          format: 'json',
          inCharset: 'utf8',
          outCharset: 'utf-8',
          platform: 'h5',
          needNewCode: 1,
          cv: 202201,
          ct: 23,
          mesh_devops: ''
        },
        req_0: {
          module: 'music.musicToplist.PlayToplist',
          method: 'GetPlayTopData',
          param: {
            songMidList: [id],
            requireSongInfo: 1
          }
        },
        req_1: {
          module: 'music.musicToplist.PlayToplist',
          method: 'HasPlayTopData',
          param: {
            songMidList: [id]
          }
        }
      }
    })

    console.log(result)

    return res.send({
      result: 100,
      data: result
    })
  },

  // 相似歌曲
  '/similar': async ({req, res, request}) => {
    const {id, raw} = req.query;
    if (!id) {
      return res.send({
        result: 500,
        errMsg: 'id ?',
      });
    }
    const result = await request(
      {
        url: 'http://u.y.qq.com/cgi-bin/musicu.fcg',
        data: JSON.stringify({
          comm: {
            g_tk: 5381,
            format: 'json',
            inCharset: 'utf-8',
            outCharset: 'utf-8',
            notice: 0,
            platform: 'h5',
            needNewCode: 1,
          },
          simsongs: {
            module: 'rcmusic.similarSongRadioServer',
            method: 'get_simsongs',
            param: {
              songid: Number(id),
            },
          },
        }),
        method: 'post',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
      {
        dataType: 'raw',
      },
    );

    if (Number(raw)) {
      return res.send(result);
    }
    return res.send({
      result: 100,
      data: result.simsongs.data.songInfoList,
    });
  },

  // 相关歌单
  '/playlist': async ({req, res, request}) => {
    const {id, raw} = req.query;
    if (!id) {
      return res.send({
        result: 500,
        errMsg: 'id ?',
      });
    }
    const result = await request(
      {
        url: 'http://u.y.qq.com/cgi-bin/musicu.fcg',
        data: JSON.stringify({
          comm: {
            g_tk: 5381,
            format: 'json',
            inCharset: 'utf-8',
            outCharset: 'utf-8',
            notice: 0,
            platform: 'h5',
            needNewCode: 1,
          },
          gedan: {
            module: 'music.mb_gedan_recommend_svr',
            method: 'get_related_gedan',
            param: {
              sin: 0,
              last_id: 0,
              song_type: 1,
              song_id: Number(id),
            },
          },
        }),
        method: 'post',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
      {
        dataType: 'raw',
      },
    );

    if (Number(raw)) {
      return res.send(result);
    }
    return res.send({
      result: 100,
      data: result.gedan.data.vec_gedan,
    });
  },

  // 相关 mv
  '/mv': async ({req, res, request}) => {
    const {id, raw} = req.query;
    if (!id) {
      return res.send({
        result: 500,
        errMsg: 'id ?',
      });
    }
    const result = await request(
      {
        url: 'http://u.y.qq.com/cgi-bin/musicu.fcg',
        data: JSON.stringify({
          comm: {
            g_tk: 5381,
            format: 'json',
            inCharset: 'utf-8',
            outCharset: 'utf-8',
            notice: 0,
            platform: 'h5',
            needNewCode: 1,
          },
          video: {
            module: 'MvService.MvInfoProServer',
            method: 'GetSongRelatedMv',
            param: {
              songid: id,
              songtype: 1,
              lastmvid: 0,
              num: 10,
            },
          },
        }),
        method: 'post',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
      {
        dataType: 'raw',
      },
    );

    if (Number(raw)) {
      return res.send(result);
    }
    return res.send({
      result: 100,
      data: result.video.data.list,
    });
  },
};
module.exports = song;
