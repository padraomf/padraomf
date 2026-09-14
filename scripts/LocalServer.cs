using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Diagnostics;
namespace PadraoMF {
  public static class LocalServer {
    static string root;
    public static void Run(string folder) {
      root = Path.GetFullPath(File.Exists(Path.Combine(folder,"index.html")) ? folder : Path.Combine(folder,"dist"));
      if(!File.Exists(Path.Combine(root,"index.html"))) throw new FileNotFoundException("Extraia o ZIP completo antes de abrir o site.");
      TcpListener server = new TcpListener(IPAddress.Any,0); server.Start();
      int port = ((IPEndPoint)server.LocalEndpoint).Port;
      string address="http://127.0.0.1:"+port+"/";
      Console.WriteLine("PADRAO MF - Site local\nAcesse no seu PC: "+address+"\nAcesse no seu CELULAR: http://192.168.1.5:"+port+"/\n\n(Lembre-se que o celular e o PC devem estar no mesmo Wi-Fi)\n\nMantenha esta janela aberta. Pressione Ctrl+C para encerrar.");
      try { Process.Start(address); } catch { Console.WriteLine("Abra o endereco acima no navegador."); }
      while(true) { TcpClient client=server.AcceptTcpClient();ThreadPool.QueueUserWorkItem(delegate(object state){Serve((TcpClient)state);},client); }
    }
    static void Header(Stream stream,int code,string reason,string type,long length,string extra) {
      byte[] data=Encoding.ASCII.GetBytes("HTTP/1.1 "+code+" "+reason+"\r\nContent-Type: "+type+"\r\nContent-Length: "+length+"\r\nConnection: close\r\nAccept-Ranges: bytes\r\nReferrer-Policy: strict-origin-when-cross-origin\r\nX-Content-Type-Options: nosniff\r\n"+extra+"\r\n");stream.Write(data,0,data.Length);
    }
    static string Mime(string path) {
      switch(Path.GetExtension(path).ToLowerInvariant()) {
        case ".html":return "text/html; charset=utf-8";case ".css":return "text/css; charset=utf-8";case ".js":return "text/javascript; charset=utf-8";case ".json":return "application/json";
        case ".woff":return "font/woff";case ".woff2":return "font/woff2";case ".otf":return "font/otf";case ".mp4":return "video/mp4";case ".webm":return "video/webm";case ".svg":return "image/svg+xml";case ".png":return "image/png";case ".jpg":case ".jpeg":return "image/jpeg";case ".webp":return "image/webp";case ".ico":return "image/x-icon";default:return "application/octet-stream";
      }
    }
    static void Serve(TcpClient client) {
      using(client) { try {
        client.ReceiveTimeout=10000;client.SendTimeout=30000;NetworkStream stream=client.GetStream();StreamReader reader=new StreamReader(stream,Encoding.ASCII,false,4096,true);
        string line=reader.ReadLine();if(String.IsNullOrEmpty(line))return;string[] request=line.Split(' ');if(request.Length<2)return;
        bool head=request[0]=="HEAD";if(request[0]!="GET"&&!head){Header(stream,405,"Method Not Allowed","text/plain",0,"Allow: GET, HEAD\r\n");return;}
        string range=null;int count=0;
        while(!String.IsNullOrEmpty(line=reader.ReadLine())){if(++count>100)return;if(line.StartsWith("Range:",StringComparison.OrdinalIgnoreCase))range=line.Substring(6).Trim();}
        Uri uri=new Uri("http://localhost"+request[1]);string relative=Uri.UnescapeDataString(uri.AbsolutePath).TrimStart('/').Replace('/',Path.DirectorySeparatorChar);
        if(relative.Length==0)relative="index.html";string path=Path.GetFullPath(Path.Combine(root,relative));
        if(!path.StartsWith(root+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase)||!File.Exists(path)){Header(stream,404,"Not Found","text/plain",0,"");return;}
        using(FileStream file=File.OpenRead(path)) {
          long start=0,end=file.Length-1;bool partial=false;
          if(range!=null){Match match=Regex.Match(range,@"^bytes=(\d*)-(\d*)$");
            if(!match.Success || (match.Groups[1].Value.Length==0&&match.Groups[2].Value.Length==0)){Header(stream,416,"Range Not Satisfiable","text/plain",0,"Content-Range: bytes */"+file.Length+"\r\n");return;}
            if(match.Groups[1].Value.Length==0){long suffix=Int64.Parse(match.Groups[2].Value);start=Math.Max(0,file.Length-suffix);}else{start=Int64.Parse(match.Groups[1].Value);if(match.Groups[2].Value.Length>0)end=Math.Min(end,Int64.Parse(match.Groups[2].Value));}
            if(start<0||start>=file.Length||end<start){Header(stream,416,"Range Not Satisfiable","text/plain",0,"Content-Range: bytes */"+file.Length+"\r\n");return;}partial=true;
          }
          long remaining=Math.Max(0,end-start+1);Header(stream,partial?206:200,partial?"Partial Content":"OK",Mime(path),remaining,partial?"Content-Range: bytes "+start+"-"+end+"/"+file.Length+"\r\n":"");
          if(head)return;file.Seek(start,SeekOrigin.Begin);byte[] buffer=new byte[65536];while(remaining>0){int n=file.Read(buffer,0,(int)Math.Min(buffer.Length,remaining));if(n==0)break;stream.Write(buffer,0,n);remaining-=n;}
        }
      } catch(IOException) {} catch(Exception) {} }
    }
  }
}
