package com.jakeoil.coylean.map;

import com.jakeoil.coylean.map.CoyleanSurfaceView.CoyleanThread;

import android.app.Activity;
import android.app.Dialog;
import android.os.Bundle;
import android.util.Log;
import android.widget.Toast;

public class Map extends Activity
{
   private static final String TAG="Coylean";
   public static final String KEY_COMPLEXITY = 
      "com.jakeoil.coylean.map.complexity";
   public static final int COMPLEXITY_SIMPLE = 0;
   public static final int COMPLEXITY_ELABORATE = 1;
   public int complexity;
   private CoyleanSurfaceView coyleanView;
   private CoyleanThread mCoyleanThread;
   @Override
   protected void onCreate(Bundle savedInstanceState)
   {
      super.onCreate(savedInstanceState);
      Log.d(TAG,"onCreate");
      complexity = getIntent().getIntExtra(KEY_COMPLEXITY, 
         COMPLEXITY_SIMPLE);
      coyleanView = new CoyleanSurfaceView(this);
      setContentView(coyleanView);
   }

}
