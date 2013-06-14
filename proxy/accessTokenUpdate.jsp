<%@ page contentType="text/html; charset=GBK" %>
<%@ page import="java.io.*" %>
<%
  String reqUrl = request.getQueryString();
  String filename = request.getRealPath("TencentToken.txt");
  java.io.File f = new java.io.File(filename);
  if(!f.exists())
  {
    f.createNewFile();
  }

  try
  {
    PrintWriter pw = new PrintWriter(new FileOutputStream(filename));
    pw.println(reqUrl);//写内容
    pw.close();
  }
  catch(IOException e) {
    e.printStackTrace();
  }
%>