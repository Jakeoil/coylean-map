package com.jakeoil.coylean.map;
import android.content.Context;
import android.media.MediaPlayer;
import android.util.Log;
public class Music
{
   private static MediaPlayer mp = null;
   public static void play(Context context, int resource,int position)
   {
      stop(context);
      mp = MediaPlayer.create(context,resource);
      mp.seekTo(position);
      mp.setLooping(true);
      mp.start();
      
   }
   public static int stop(Context context)
   {
      int position=0;
      if(mp!=null)
      {
        position = mp.getCurrentPosition();
        Log.d ("Music","Position:" + position);
        mp.stop();
        mp.release();
        mp=null;
      }
      return position;
   }

}
