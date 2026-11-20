import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const trackingId = req.nextUrl.searchParams.get('t')
  if (!trackingId) {
    return new NextResponse('// OutreachAI: missing tracking ID', { status: 400, headers: { 'Content-Type': 'application/javascript' } })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://outreachai.in'

  const js = `(function(){
  var t=${JSON.stringify(trackingId)};
  var b=${JSON.stringify(appUrl)};
  function s(){
    var u=encodeURIComponent(window.location.href);
    var r=encodeURIComponent(document.referrer||'');
    var img=new Image();
    img.src=b+'/api/track/visit?t='+t+'&u='+u+'&r='+r;
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',s)}else{s();}
})();`

  return new NextResponse(js, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
