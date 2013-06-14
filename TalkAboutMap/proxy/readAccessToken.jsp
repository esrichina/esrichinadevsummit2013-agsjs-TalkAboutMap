<%@ page contentType="text/html; charset=GBK" %>
<%@ page import="java.io.*" %>
<%
  String filename = request.getRealPath("TencentToken.txt");
  java.io.File f = new java.io.File(filename);
  if(!f.exists())
   return;

  try
  {
    java.io.FileReader fr = new java.io.FileReader(f);
    char[] buffer = new char[100];
    int length;
    String result = "";
    StringBuffer sb = new StringBuffer();
    while((length=fr.read(buffer))!=-1){
      String str = new String(buffer,0,length);
      sb.append(str);
    }
    fr.close();
    result = sb.toString().replaceAll(" ","");
    out.print(result);
  }
  catch(IOException e) {
    e.printStackTrace();
  }
%>